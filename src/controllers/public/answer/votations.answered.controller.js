import mongoose from "mongoose";
import { request, response } from "express";
import { AnswerModel } from "../../../models/answer.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/user/votations/answered?page=1&limit=10
export class VotationsAnsweredController {
  run = async (req = request, res = response) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const userId = req.userId;

      // 1️⃣ Validar userId
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de usuario inválido"
        });
      }

      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.min(parseInt(limit), 50);
      const skip = (numericPage - 1) * numericLimit;

      // 2️⃣ Pipeline de agregación
      const pipeline = [
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: "$votationId",
            totalAnswers: { $sum: 1 },
            lastAnswerDate: { $max: "$created_at" }
          }
        },
        {
          $lookup: {
            from: "votations",
            localField: "_id",
            foreignField: "_id",
            as: "votation"
          }
        },
        { $unwind: "$votation" },
        {
          $project: {
            _id : "$_id",
            votationId: "$_id",
            subject: "$votation.subject",
            description: "$votation.description",
            closesAt: "$votation.closes_at",
            createdAt: "$votation.created_at",
            ownerId: "$votation.ownerId",
            totalAnswers: 1,
            lastAnswerDate: 1
          }
        },
        { $sort: { lastAnswerDate: -1 } },
        { $skip: skip },
        { $limit: numericLimit }
      ];

      // 3️⃣ Ejecutar pipeline con Circuit Breaker
      const items = await dbBreaker.call(
        () => AnswerModel.aggregate(pipeline),
        fallBacksBreaker.fallbackEmptyArray
      );

      // 4️⃣ Obtener total de votaciones donde ha respondido
      const totalResult = await dbBreaker.call(
        () => AnswerModel.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId) } },
          { $group: { _id: "$votationId" } },
          { $count: "total" }
        ]),
        fallBacksBreaker.fallbackCount
      );

      const total = totalResult[0]?.total || 0;

      // 5️⃣ Enriquecer items con status
      const now = new Date();
      const enrichedItems = items.map(item => ({
        _id: item.votationId,
        subject: item.subject,
        description: item.description,
        closesAt: item.closesAt,
        createdAt: item.createdAt,
        ownerId: item.ownerId,
        totalAnswers: item.totalAnswers,
        lastAnswerDate: item.lastAnswerDate,
        status: new Date(item.closesAt) > now ? "active" : "closed",
        isOwner: item.ownerId.toString() === userId
      }));

      return res.json({
        ok: true,
        data: enrichedItems,
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
      console.error("Error en VotationsAnswered:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener votaciones respondidas"
      });
    }
  };
}