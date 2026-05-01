import mongoose from "mongoose";
import { request, response } from "express";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { VotationModel } from "../../../models/votation.model.js";
import { UserModel } from "../../../models/user.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/admin/invitations/pending-sent
export class GetPendingInvitationsSentController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.query;
      const { page, limit } = req.query;
      const numericPage = Math.max(parseInt(page || 1), 1);
      const numericLimit = Math.max(parseInt(limit || 10), 10);
      const skip = (numericPage - 1) * numericLimit;

      const userId = req.userId;

      const matchCondition = {
        invitedByUserId: userId,
        status: "PENDING"
      };

      if (votationId && mongoose.Types.ObjectId.isValid(votationId)) {
        matchCondition.votationid = new mongoose.Types.ObjectId(votationId);
      }

      // 1️⃣ Obtener invitaciones pendientes (protegido)
      const pendingInvitations = await dbBreaker.call(
        () => AdminMemberByVotationModel.find(matchCondition)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(numericLimit)
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      // Si no hay invitaciones, respuesta rápida
      if (pendingInvitations.length === 0) {
        return res.json({
          ok: true,
          message: "No hay invitaciones pendientes",
          data: {
            invitations: [],
			totalInvitations: 0
          },
          pagination: {
            page: numericPage,
            limit: numericLimit,
            total: 0,
            totalPages: 0,
            hasPrev: false,
            hasNext: false
          }
        });
      }

      // Extraer IDs de votaciones y emails únicos
      const pendingVotationsIds = [...new Set(
        pendingInvitations.map(inv => inv.votationid.toString())
      )];

      const pendingInvitationsEmails = [...new Set(
        pendingInvitations.map(inv => inv.invitedEmail)
      )];

      // 2️⃣ Obtener detalles de votaciones (protegido)
      const votations = await dbBreaker.call(
        () => VotationModel.find({
          _id: { $in: pendingVotationsIds.map(id => new mongoose.Types.ObjectId(id)) }
        }).select("subject description").lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const votationsMap = new Map(
        votations.map(v => [v._id.toString(), v])
      );

      // 3️⃣ Obtener información de usuarios invitados (protegido)
      const users = await dbBreaker.call(
        () => UserModel.find({
          email: { $in: pendingInvitationsEmails }
        }).select("email").lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const usersMap = new Map(
        users.map(u => [u.email, u.email])
      );

      // 4️⃣ Armar respuesta enriquecida
      const data = pendingInvitations.map(inv => ({
        invitationId: inv._id,
        votation: votationsMap.get(inv.votationid.toString()) || {
          subject: "Votación",
          description: null
        },
        invitedEmail: inv.invitedEmail,
        userExists: usersMap.has(inv.invitedEmail),
        role: inv.ROLES,
        status: inv.status,
        sentAt: inv.created_at
      }));

      // 5️⃣ Total para paginación (protegido)
      const totalResult = await dbBreaker.call(
        () => AdminMemberByVotationModel.countDocuments(matchCondition),
        fallBacksBreaker.fallBackZero
      );

      const totalCount = totalResult || 0;
      const totalPages = Math.ceil(totalCount / numericLimit);

      return res.json({
        ok: true,
        message: "Invitaciones pendientes obtenidas exitosamente",
        data : {
          invitations: data,
		  totalInvitations: totalCount
        },
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total: totalCount,
          totalPages,
          hasPrev: numericPage > 1,
          hasNext: numericPage < totalPages
        }
      });

    } catch (err) {
      console.error("Error en GetPendingInvitationsSentController:", err);
      
      return res.status(500).json({
        ok: false,
        message: "Error al obtener invitaciones enviadas."
      });
    }
  };
}