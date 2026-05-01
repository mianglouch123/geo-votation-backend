import mongoose from "mongoose";
import { request, response } from "express";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";

//GET /api/user/invitations/pending?page=1&limit=10

export class GetMyPendingInvitationsController {
  run = async (req = request, res = response) => {
    try {
      const userEmail = req.user.email;
      const userId = req.userId;
      const { page = 1, limit = 10 } = req.query;
      
      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 10);
      const skip = (numericPage - 1) * numericLimit;

      // Pipeline de agregación
      const pipeline = [
        // 1️⃣ Match: mis invitaciones pendientes
        {
          $match: {
            invitedEmail: userEmail,
            status: "PENDING"
          }
        },
        
        // 2️⃣ Lookup de la votación
        {
          $lookup: {
            from: "votations",
            localField: "votationid",
            foreignField: "_id",
            as: "votation"
          }
        },
        { $unwind: { path: "$votation", preserveNullAndEmptyArrays: false } },
        
        // 3️⃣ Lookup de quien invitó
        {
          $lookup: {
            from: "users",
            localField: "invitedByUserId",
            foreignField: "_id",
            as: "inviter"
          }
        },
        { $unwind: { path: "$inviter", preserveNullAndEmptyArrays: false } },
        
        // 4️⃣ Proyectar campos necesarios
        {
          $project: {
            invitationId: "$_id",
            _id: 0,
            votation: {
              id: "$votation._id",
              subject: "$votation.subject",
              description: "$votation.description",
              closes_at: "$votation.closes_at"
            },
            invitedBy: {
              id: "$inviter._id",
              email: "$inviter.email"
            },
            role: "$ROLES",
            sentAt: "$created_at",
            status: 1
          }
        },
        
        // 5️⃣ Ordenar por fecha (más recientes primero)
        { $sort: { sentAt: -1 } },
        
        // 6️⃣ Paginación
        { $skip: skip },
        { $limit: numericLimit }
      ];

      // Ejecutar pipeline
      const invitations = await AdminMemberByVotationModel.aggregate(pipeline);

      // Obtener total para paginación
      const total = await AdminMemberByVotationModel.countDocuments({
        invitedEmail: userEmail,
        status: "PENDING"
      });

      const totalPages = Math.ceil(total / numericLimit);

      // Calcular tiempo restante para cada invitación
      const now = new Date();
      const invitationsWithMeta = invitations.map(inv => ({
        ...inv,
        expiresIn: this.getExpirationTime(inv.sentAt),
        isExpired: this.isExpired(inv.sentAt)
      }));

      return res.json({
        ok: true,
        message: total > 0 
          ? "Invitaciones pendientes obtenidas"
          : "No tienes invitaciones pendientes",
        data: invitationsWithMeta,
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          totalPages,
          hasPrev: numericPage > 1,
          hasNext: numericPage < totalPages
        }
      });

    } catch (err) {
      console.error("Error en GetMyPendingInvitationsController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener invitaciones"
      });
    }
  };

  getExpirationTime(sentAt) {
    const sent = new Date(sentAt);
    const now = new Date();
    const diffDays = Math.floor((now - sent) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 7) return "Expirada";
    if (diffDays > 0) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffDays === 0) return "Hoy";
    return "Reciente";
  }

  isExpired(sentAt) {
    const sent = new Date(sentAt);
    const now = new Date();
    const diffDays = (now - sent) / (1000 * 60 * 60 * 24);
    return diffDays > 7; // Expiran después de 7 días
  }
}