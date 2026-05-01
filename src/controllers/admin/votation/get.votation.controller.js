import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

export class GetVotationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();

    try {
      const { votationId } = req.query;
      const userId = req.userId;
      const numericPage = Math.max(parseInt(req.query?.page || 1), 1);
      const numericLimit = Math.max(parseInt(req.query.limit || 10), 1);
      const skip = (numericPage - 1) * numericLimit;

      const matchStage = {};

      // Validar ID si viene
      if (votationId !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(votationId)) {
          return res.status(400).json({
            ok: false,
            message: "ID de votación inválido"
          });
        }
        matchStage._id = new mongoose.Types.ObjectId(votationId);
      }

      // ===========================================
      // OBTENER IDs DE VOTACIONES DONDE ES MIEMBRO
      // ===========================================
      let memberVotationIds = [];

      if (!votationId || votationId === "undefined") {
        const memberRecords = await dbBreaker.call(
          () =>
            AdminMemberByVotationModel.find({
              invitedUserId: userId,
              status: "ACCEPTED"
            })
              .select("votationid")
              .lean(),
          fallBacksBreaker.fallbackEmptyArray
        );

        memberVotationIds = memberRecords.map((m) => m.votationid);
      }

      // ===========================================
      // CONSTRUIR PIPELINE
      // ===========================================
      const pipeline = [
        ...(Object.keys(matchStage).length > 0
          ? [{ $match: matchStage }]
          : [
              {
                $match: {
                  $or: [
                    { ownerId: new mongoose.Types.ObjectId(userId) },
                    { _id: { $in: memberVotationIds } }
                  ]
                }
              }
            ]),

        {
          $lookup: {
            from: "users",
            localField: "ownerId",
            foreignField: "_id",
            pipeline: [{ $project: { _id: 1, email: 1 } }],
            as: "owner"
          }
        },
        { $unwind: "$owner" },

        {
          $lookup: {
            from: "questions",
            let: { votationId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$votationId", "$$votationId"] },
                      { $eq: ["$isActive", true] }
                    ]
                  }
                }
              },
              {
                $lookup: {
                  from: "questionconfigs",
                  localField: "_id",
                  foreignField: "questionId",
                  as: "config"
                }
              },
              { $unwind: { path: "$config", preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: "answers",
                  let: { questionId: "$_id" },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ["$questionId", "$$questionId"] }
                      }
                    },
                    { $count: "total" }
                  ],
                  as: "answerCount"
                }
              },
              {
                $unwind: {
                  path: "$answerCount",
                  preserveNullAndEmptyArrays: true
                }
              },
              {
                $addFields: {
                  totalAnswers: { $ifNull: ["$answerCount.total", 0] }
                }
              },
              { $project: { answerCount: 0 } }
            ],
            as: "questions"
          }
        },

        {
          $addFields: {
            isClosed: { $lt: ["$closes_at", new Date()] }
          }
        },

        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: numericLimit }
      ];

      // ===========================================
      // AGGREGATE PRINCIPAL (CRÍTICO)
      // ===========================================
      let votations = [];

      try {
        votations = await dbBreaker.call(
          () => VotationModel.aggregate(pipeline),
          () => fallBacksBreaker.fallbackCritical("getVotations")
        );
      } catch (breakerErr) {
        if (breakerErr.message === "CIRCUIT_OPEN") {
          return res.status(503).json({
            ok: false,
            message:
              "Servicio temporalmente no disponible. Intenta más tarde.",
            retryAfter: 30
          });
        }
        throw breakerErr;
      }

      // ===========================================
      // TOTAL (SEMI-CRÍTICO)
      // ===========================================
      let total = votations.length;

      if (!matchStage._id) {
        const countPipeline = [
          {
            $match: {
              $or: [
                { ownerId: new mongoose.Types.ObjectId(userId) },
                { _id: { $in: memberVotationIds } }
              ]
            }
          },
          { $count: "total" }
        ];

        const countResult = await dbBreaker.call(
          () => VotationModel.aggregate(countPipeline),
          fallBacksBreaker.fallbackCount
        );

        total = countResult[0]?.total || 0;
      }

      // ===========================================
      // RESPUESTA
      // ===========================================
      const message = matchStage._id
        ? `Votación obtenida exitosamente ${votationId}`
        : "Votaciones obtenidas exitosamente";

      return res.status(200).json({
        ok: true,
        message,
        data: matchStage._id ? votations[0] : votations,
        metadata: {
          ...(!matchStage._id && {
            pagination: {
              page: numericPage,
              limit: numericLimit,
              total,
              pages: Math.ceil(total / numericLimit)
            }
          })
        }
      });
    } catch (err) {
      console.error("Error en GetVotationController:", err);

      return res.status(500).json({
        ok: false,
        message: "Error interno del servidor",
        error: err.message
      });
    } finally {
      session.endSession();
    }
  };
}