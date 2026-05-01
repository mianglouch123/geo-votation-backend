// controllers/search/search.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../models/votation.model.js";
import { UserModel } from "../../models/user.model.js";
import { dbBreaker } from "../../middlewares/circuit-breaker/circuit.breaker.js";
import { AdminMemberByVotationModel } from "../../models/admin.member.votation.model.js";
import { fallBacksBreaker } from "../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/search?q=texto&type=votations|users&page=1&limit=10
// GET /api/search?q=texto (busca en ambos)
export class SearchController {
  run = async (req = request, res = response) => {
    try {
      const { q, type, page = 1, limit = 10 } = req.query;
      const searchTerm = q?.trim();
      const userId = req.userId;

      if (!searchTerm || searchTerm.length < 2) {
        return res.status(400).json({
          ok: false,
          message: "El término de búsqueda debe tener al menos 2 caracteres"
        });
      }

      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 1);
      const skip = (numericPage - 1) * numericLimit;

      const searchRegex = new RegExp(searchTerm, 'i');
      const results = {};
      const searchTypes = type ? [type] : ['votations', 'users'];

      await Promise.all(
        searchTypes.map(async (searchType) => {
          switch (searchType) {
            case 'votations':
              results.votations = await this.searchVotations(userId, searchTerm, numericPage, numericLimit, skip);
              break;
            case 'users':
              results.users = await this.searchUsers(userId, searchRegex, numericPage, numericLimit, skip);
              break;
          }
        })
      );

      return res.json({
        ok: true,
        data: results,
        metadata: {
          query: searchTerm,
          types: searchTypes,
          page: numericPage,
          limit: numericLimit
        }
      });

    } catch (err) {
      console.error("Error en SearchController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al realizar la búsqueda"
      });
    }
  };

  // ===========================================
  // BÚSQUEDA DE USUARIOS (solo con los que compartes votaciones)
  // ===========================================
  async searchUsers(userId, searchRegex, page, limit, skip) {
    // 1️⃣ Obtener IDs de votaciones donde participa
    const userVotations = await dbBreaker.call(
      async () => {
        const owned = await VotationModel.find({ ownerId: userId }).select("_id").lean();
        const member = await AdminMemberByVotationModel.find({
          invitedUserId: userId,
          status: "ACCEPTED"
        }).select("votationid").lean();
        
        const ids = [
          ...owned.map(v => v._id),
          ...member.map(m => m.votationid)
        ];
        return ids;
      },
      fallBacksBreaker.fallbackEmptyArray
    );

    if (userVotations.length === 0) {
      return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    // 2️⃣ Buscar usuarios por email en esas votaciones (miembros)
    const members = await dbBreaker.call(
      () => AdminMemberByVotationModel.find({
        votationid: { $in: userVotations.map(id => new mongoose.Types.ObjectId(id)) },
        invitedEmail: searchRegex,
        status: "ACCEPTED"
      })
        .select("invitedUserId invitedEmail")
        .skip(skip)
        .limit(limit)
        .lean(),
      fallBacksBreaker.fallbackEmptyArray
    );

    const userIds = members.map(m => m.invitedUserId).filter(id => id && id.toString() !== userId.toString());

    // 3️⃣ Obtener detalles de usuarios
    const [items, total] = await Promise.all([
      dbBreaker.call(
        () => UserModel.find({ _id: { $in: userIds } })
          .select("email isVerfied created_at")
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      ),
      dbBreaker.call(
        () => AdminMemberByVotationModel.countDocuments({
          votationid: { $in: userVotations.map(id => new mongoose.Types.ObjectId(id)) },
          invitedEmail: searchRegex,
          status: "ACCEPTED"
        }),
        fallBacksBreaker.fallBackZero
      )
    ]);

    return {
      items: items.map(u => ({
        id: u._id,
        email: u.email,
        isVerified: u.isVerfied,
        registeredAt: u.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // ===========================================
  // BÚSQUEDA DE VOTACIONES (donde participa o es dueño)
  // ===========================================
  async searchVotations(userId, searchTerm, page, limit, skip) {
    // 1️⃣ Obtener IDs de votaciones donde participa
    const userVotations = await dbBreaker.call(
      async () => {
        const owned = await VotationModel.find({ ownerId: userId }).select("_id").lean();
        const member = await AdminMemberByVotationModel.find({
          invitedUserId: userId,
          status: "ACCEPTED"
        }).select("votationid").lean();
         
        
        return [
          ...owned.map(v => v._id),
          ...member.map(m => m.votationid)
        ];
      },
      fallBacksBreaker.fallbackEmptyArray
    );
    if (userVotations.length === 0) {
      return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    // 2️⃣ Construir query correcta
    const query = {
      _id: { $in: userVotations.map(id => new mongoose.Types.ObjectId(id)) },
       $or: [
     { subject: { $regex: searchTerm, $options: 'i' } },      // ← Usar $regex
     { description: { $regex: searchTerm, $options: 'i' } }   // ← Usar $regex
    ]
    };

    // 3️⃣ Ejecutar búsqueda
    const [items, total] = await Promise.all([
      dbBreaker.call(
        () => VotationModel.find(query)
          .select("subject description closes_at created_at ownerId")
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      ),
      dbBreaker.call(
        () => VotationModel.countDocuments(query),
        fallBacksBreaker.fallBackZero
      )
    ]);
    // 4️⃣ Obtener emails de los owners
    const ownerIds = [...new Set(items.map(v => v.ownerId.toString()))];
    const owners = await dbBreaker.call(
      () => UserModel.find({ _id: { $in: ownerIds } }).select("email").lean(),
      fallBacksBreaker.fallbackEmptyArray
    );

    const ownerMap = new Map(owners.map(o => [o._id.toString(), o.email]));

    const itemsWithOwner = items.map(v => ({
      id: v._id,
      subject: v.subject,
      description: v.description?.substring(0, 100) + (v.description?.length > 100 ? '...' : ''),
      closesAt: v.closes_at,
      createdAt: v.created_at,
      ownerEmail: ownerMap.get(v.ownerId.toString()) || 'Usuario',
      status: new Date(v.closes_at) > new Date() ? 'active' : 'closed'
    }));

    return {
      items: itemsWithOwner,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}