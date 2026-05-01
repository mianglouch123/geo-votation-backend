// controllers/members/get.members.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { UserModel } from "../../../models/user.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/admin/votations/:votationId/members?page=1&limit=10&searchEmail=juan
export class GetMembersController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.params;
      const { page = 1, limit = 10, searchEmail } = req.query;
      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 10);
      const skip = (numericPage - 1) * numericLimit;

      // Validar ID
      if (!votationId) {
        return res.status(400).json({
          ok: false,
          message: "Votation ID es requerida."
        });
      }

      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "Votation ID inválido."
        });
      }

      // Verificar que la votación existe
      const votation = await VotationModel.findById(votationId).lean();
      if (!votation) {
        return res.status(404).json({
          ok: false,
          message: `Votacion: ${votationId} no encontrada`
        });
      }

      // ===========================================
      // 🔥 BÚSQUEDA POR EMAIL
      // ===========================================
      let emailFilter = null;
      let searchMetadata = null;

      if (searchEmail && searchEmail !== "undefined" && searchEmail.trim().length > 0) {
        const searchTerm = searchEmail.trim();
        const searchPage = parseInt(req.query.searchPage) || 1;
        const SEARCH_LIMIT = 50;
        const searchSkip = (searchPage - 1) * SEARCH_LIMIT;

        // Buscar usuarios por email (regex)
        const users = await dbBreaker.call(
          () => UserModel.find({
            email: { $regex: searchTerm, $options: 'i' }
          })
            .select("_id email")
            .skip(searchSkip)
            .limit(SEARCH_LIMIT)
            .lean(),
          fallBacksBreaker.fallbackEmptyArray
        );

        // Total de usuarios que coinciden (para paginación de búsqueda)
        const totalUsers = await UserModel.countDocuments({
          email: { $regex: searchTerm, $options: 'i' }
        });

        const userIds = users.map(u => u._id.toString());

        // Metadata para paginación de búsqueda
        searchMetadata = {
          searchEmail: searchTerm,
          searchPage,
          searchLimit: SEARCH_LIMIT,
          totalUsers,
          totalSearchPages: Math.ceil(totalUsers / SEARCH_LIMIT)
        };

        // Construir filtro OR: buscar por invitedUserId O invitedEmail
        const orConditions = [
          { invitedEmail: { $regex: searchTerm, $options: 'i' } }
        ];
        
        if (userIds.length > 0) {
          orConditions.unshift({ invitedUserId: { $in: userIds } });
        }

        emailFilter = { $or: orConditions };

        
      }

      // ===========================================
      // PIPELINE DE AGREGACIÓN
      // ===========================================
      const matchStage = {
        votationid: new mongoose.Types.ObjectId(votationId),
        status: "ACCEPTED"
      };

      let finalMatchStage = matchStage;
      if (emailFilter) {
        finalMatchStage = {
          $and: [matchStage, emailFilter]
        };
      }

      const pipeline = [
        { $match: finalMatchStage },
        {
          $lookup: {
            from: "users",
            let: { userEmail: "$invitedEmail", userId: "$invitedUserId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$email", "$$userEmail"] },
                      { $eq: ["$_id", "$$userId"] }
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  userId: "$_id",
                  email: 1
                }
              }
            ],
            as: "userInfo"
          }
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            invitationId: "$_id",
            userId: { $ifNull: ["$userInfo.userId", "$invitedUserId"] },
            email: { $ifNull: ["$userInfo.email", "$invitedEmail"] },
            role: "$ROLES",
            invitedBy: "$invitedByUserId",
            joinedAt: "$created_at"
          }
        },
        { $sort: { joinedAt: -1 } },
        { $skip: skip },
        { $limit: numericLimit }
      ];

      const members = await AdminMemberByVotationModel.aggregate(pipeline);
      const total = await AdminMemberByVotationModel.countDocuments(finalMatchStage);
      const totalPages = Math.ceil(total / numericLimit);

      // Construir respuesta
      const responseData = {
        ok: true,
        data: {
          members,
          totalMembers: total,
          ...(searchMetadata && {
           searchMetadata
           }),
           ...(searchEmail && searchEmail !== "undefined" && searchEmail.trim().length > 0 && { 
            filters : { searchEmail : searchEmail.trim() },
           })
        },
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          totalPages,
          hasPrev: numericPage > 1,
          hasNext: numericPage < totalPages
        }
      };


      return res.status(200).json(responseData);

    } catch (err) {
      console.error("Error en GetMembersController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener miembros"
      });
    }
  };
}