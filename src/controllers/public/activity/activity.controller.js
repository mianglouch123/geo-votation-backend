import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { UserModel } from "../../../models/user.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";



// GET /api/user/activity?page=1&limit=20
export class ActivityController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;
      const { page = 1, limit = 20 } = req.query;

      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 1);
      const skip = (numericPage - 1) * numericLimit;

      const ownedVotations = await dbBreaker.call(
        () => VotationModel.find({ ownerId: userId }).select("_id").lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const memberRecords = await dbBreaker.call(
        () => AdminMemberByVotationModel.find({
          invitedUserId: userId,
          status: "ACCEPTED"
        }).select("votationid").lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const votationIds = [
        ...ownedVotations.map(v => v._id),
        ...memberRecords.map(m => m.votationid)
      ];

      if (votationIds.length === 0) {
        return res.json({
          ok: true,
          data: [],
          pagination: {
            page: numericPage,
            limit: numericLimit,
            total: 0,
            totalPages: 0
          }
        });
      }

      // ===========================================
      // PIPELINE DE ACTIVIDAD
      // ===========================================
      const activitiesPipeline = [
        // VOTATIONS
        {
          $match: { _id: { $in: votationIds } }
        },
        {
          $project: {
            id: "$_id",
            type: { $literal: "votation" },
            timestamp: "$created_at",
            votationTitle: "$subject",
            ownerId: 1
          }
        },

        // ANSWERS
        {
          $unionWith: {
            coll: "answers",
            pipeline: [
              {
                $match: {
                  votationId: { $in: votationIds }
                }
              },
              {
               $group : {
                _id : "$votationId",
                count : { $sum : 1 },
                lastAnswer: { $max: "$created_at" }
               }
              },
              {
                $project: {
                  id: "$_id",
                  type: { $literal: "answer_summary" },
                  count : 1,
                  timestamp: "$lastAnswer"
                }
              }
            ]
          }
        },

        // MEMBERS
        {
          $unionWith: {
            coll: "adminmemberbyvotations",
            pipeline: [
              {
                $match: {
                  votationid: { $in: votationIds },
                  status: "ACCEPTED"
                }
              },
              {
                $project: {
                  id: "$_id",
                  type: { $literal: "member" },
                  timestamp: "$created_at",
                  userId: "$invitedUserId",
                  votationId: "$votationid"
                }
              }
            ]
          }
        },

        // ORDEN GLOBAL
        { $sort: { timestamp: -1, id: -1 } },

        // PAGINACIÓN
        { $skip: skip },
        { $limit: numericLimit }
      ];

      // Ejecutar pipeline principal
      let activities = [];
      try {
        activities = await dbBreaker.call(
          () => VotationModel.aggregate(activitiesPipeline),
          () => fallBacksBreaker.fallbackCritical("Activities Pipeline")
        );
      } catch (errBreaker) {
        if (errBreaker.message === "CIRCUIT_OPEN") {
          return res.status(503).json({
            ok: false,
            message: "Servicio temporalmente no disponible. Intenta más tarde.",
            retryAfter: 30
          });
        }
        throw errBreaker;
      }

      // Pipeline para contar total (sin paginación)
      const countPipeline = [
        // VOTATIONS
        {
          $match: { _id: { $in: votationIds } }
        },
        {
          $project: {
            type: { $literal: "votation" },
            timestamp: "$created_at"
          }
        },
        {
          $unionWith: {
            coll: "answers",
            pipeline: [
              {
                $match: { votationId: { $in: votationIds } }
              },
              {
                $project: {
                  type: { $literal: "answer" },
                  timestamp: "$created_at"
                }
              }
            ]
          }
        },
        {
          $unionWith: {
            coll: "adminmemberbyvotations",
            pipeline: [
              {
                $match: {
                  votationid: { $in: votationIds },
                  status: "ACCEPTED"
                }
              },
              {
                $project: {
                  type: { $literal: "member" },
                  timestamp: "$created_at"
                }
              }
            ]
          }
        },
        { $count: "total" }
      ];

      let totalResult = [];
      try {
        totalResult = await dbBreaker.call(
          () => VotationModel.aggregate(countPipeline),
          fallBacksBreaker.fallbackCount
        );
      } catch (breakerErr) {
        totalResult = fallBacksBreaker.fallbackCount
      }

      const total = totalResult[0]?.total || 0;

      return res.json({
        ok: true,
        data: activities,
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          totalPages: Math.ceil(total / numericLimit),
          hasPrev: numericPage > 1,
          hasNext: numericPage < Math.ceil(total / numericLimit)
        }
      });

    } catch (err) {
      console.error("Error en ActivityController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener actividad"
      });
    }
  };
}