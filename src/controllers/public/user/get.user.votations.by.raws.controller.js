// controllers/user/get.user.votations.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

const LIMIT_BREAKER = 10;

// GET /api/user/votations-by-raw?type=participation&type=created&type=answered&page=1&limit=10&searchTerm=hola
export class GetUserVotationsByRawController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;
      const userEmail = req.user.email;
      const { searchTerm = null } = req.query;

      // 1️⃣ Parámetros globales
      const globalPage = Math.max(parseInt(req.query.page || 1), 1);
      const globalLimit = Math.max(parseInt(req.query.limit || LIMIT_BREAKER), 1);

      // 2️⃣ Procesar tipos
      const types = req.query.types || [];
      const typesArray = Array.isArray(types) ? types : [types];
      const requestedTypes = typesArray.length > 0 ? typesArray : ['participation', 'created', 'answered'];

      // 3️⃣ Función para paginación por tipo
      const getPageForType = (type) => {
        const page = Math.max(parseInt(req.query[`${type}Page`] || globalPage), 1);
        const limit = Math.max(parseInt(req.query[`${type}Limit`] || globalLimit), 1);
        return {
          page,
          limit,
          skip: (page - 1) * limit
        };
      };

      // 4️⃣ Inicializar resultados
      const results = {};

      // 5️⃣ Ejecutar consultas en paralelo
      await Promise.all(
        requestedTypes.map(async (type) => {
          const pagination = getPageForType(type);
          switch(type) {
            case 'participation':
              results.participation = await this.getParticipatingVotations(userEmail, pagination, searchTerm);
              break;
            case 'created':
              results.created = await this.getCreatedVotations(userId, pagination, searchTerm);
              break;
            case 'answered':
              results.answered = await this.getAnsweredVotations(userId, pagination, searchTerm);
              break;
            default:
              break;
          }
        })
      );

      // 6️⃣ Metadata
      const metadata = {
        global: {
          page: globalPage,
          limit: globalLimit,
          types: requestedTypes,
          searchTerm: searchTerm || null
        },
        types: {}
      };

      requestedTypes.forEach(type => {
        metadata.types[type] = getPageForType(type);
      });

      return res.json({
        ok: true,
        data: results,
        metadata
      });

    } catch (err) {
      console.error("Error en GetUserVotationsController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener votaciones del usuario"
      });
    }
  };

  // ===========================================
  // Votaciones donde participa (como miembro)
  // ===========================================
  async getParticipatingVotations(userEmail, pagination, searchTerm = null) {
    // Primero obtener los IDs de las votaciones donde participa
    const memberRecords = await dbBreaker.call(
      () => AdminMemberByVotationModel.find({
        invitedEmail: userEmail,
        status: "ACCEPTED"
      })
        .select("votationid ROLES")
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      fallBacksBreaker.fallbackEmptyArray
    );

    const votationIds = memberRecords.map(m => m.votationid.toString());

    if (votationIds.length === 0) {
      return {
        items: [],
        pagination: {
          ...pagination,
          total: 0,
          totalPages: 0
        }
      };
    }

    // Construir filtro de búsqueda
    const searchFilter = searchTerm ? {
      $or: [
        { subject: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    } : {};

    // Obtener las votaciones con filtro
    const votations = await dbBreaker.call(
      () => VotationModel.find({
        _id: { $in: votationIds },
        ...searchFilter
      })
        .select("subject description closes_at created_at ownerId")
        .lean(),
      fallBacksBreaker.fallbackEmptyArray
    );

    const roleMap = new Map(
      memberRecords.map(m => [m.votationid.toString(), m.ROLES])
    );

    const items = votations.map(v => ({
      id: v._id,
      subject: v.subject,
      description: v.description,
      closesAt: v.closes_at,
      createdAt: v.created_at,
      role: roleMap.get(v._id.toString()) || "NO ROLE DEFINED",
      isOwner: false,
      status: new Date(v.closes_at) > new Date() ? "active" : "closed"
    }));

    // Total con filtro de búsqueda
    const total = await dbBreaker.call(
      () => AdminMemberByVotationModel.countDocuments({
        invitedEmail: userEmail,
        status: "ACCEPTED",
        votationid: { $in: votations.map(v => v._id) }
      }),
      fallBacksBreaker.fallBackZero
    );

    return {
      items,
      pagination: {
        ...pagination,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  // ===========================================
  // Votaciones creadas (como owner)
  // ===========================================
  async getCreatedVotations(userId, pagination, searchTerm = null) {
    const searchFilter = searchTerm ? {
      $or: [
        { subject: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    } : {};

    const [items, total] = await Promise.all([
      dbBreaker.call(
        () => VotationModel.find({
          ownerId: userId,
          ...searchFilter
        })
          .select("subject description closes_at created_at")
          .sort({ created_at: -1 })
          .skip(pagination.skip)
          .limit(pagination.limit)
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      ),
      dbBreaker.call(
        () => VotationModel.countDocuments({
          ownerId: userId,
          ...searchFilter
        }),
        fallBacksBreaker.fallBackZero
      )
    ]);

    return {
      items: items.map(v => ({
        id: v._id,
        subject: v.subject,
        description: v.description,
        closesAt: v.closes_at,
        createdAt: v.created_at,
        role: "OWNER",
        isOwner: true,
        status: new Date(v.closes_at) > new Date() ? "active" : "closed"
      })),
      pagination: {
        ...pagination,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  // ===========================================
  // Votaciones donde ha respondido
  // ===========================================
  async getAnsweredVotations(userId, pagination, searchTerm = null) {
    // Obtener IDs de votaciones donde ha respondido
    const answeredVotations = await dbBreaker.call(
      () => AnswerModel.aggregate([
        { $match: { userId } },
        { $group: { _id: "$votationId" } },
        { $skip: pagination.skip },
        { $limit: pagination.limit }
      ]),
      fallBacksBreaker.fallbackEmptyArray
    );

    const votationIds = answeredVotations.map(v => v._id.toString());

    if (votationIds.length === 0) {
      return {
        items: [],
        pagination: {
          ...pagination,
          total: 0,
          totalPages: 0
        }
      };
    }

    const searchFilter = searchTerm ? {
      $or: [
        { subject: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    } : {};

    // Obtener las votaciones con filtro
    const votations = await dbBreaker.call(
      () => VotationModel.find({
        _id: { $in: votationIds },
        ...searchFilter
      })
        .select("subject description closes_at created_at ownerId")
        .lean(),
      fallBacksBreaker.fallbackEmptyArray
    );

    // Total de votaciones respondidas que coinciden con el filtro
    const total = await dbBreaker.call(
      () => AnswerModel.aggregate([
        { $match: { userId } },
        { $group: { _id: "$votationId" } },
        { $match: { _id: { $in: votations.map(v => v._id) } } },
        { $count: "total" }
      ]),
      fallBacksBreaker.fallbackCount
    );

    const totalCount = total[0]?.total || 0;

    return {
      items: votations.map(v => ({
        id: v._id,
        subject: v.subject,
        description: v.description,
        closesAt: v.closes_at,
        createdAt: v.created_at,
        role: v.ownerId.toString() === userId ? "OWNER" : "MEMBER",
        isOwner: v.ownerId.toString() === userId,
        status: new Date(v.closes_at) > new Date() ? "active" : "closed"
      })),
      pagination: {
        ...pagination,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pagination.limit)
      }
    };
  }
}