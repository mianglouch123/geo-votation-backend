// controllers/admin/votations/stats.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { QuestionModel } from "../../../models/question.model.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";


// GET /api/admin/votations/:votationId/stats
export class VotationStatsController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.params;
      const userId = req.userId;

      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      // Verificar que la votación existe
      const votation = await VotationModel.findById(votationId).lean();
      
      if (!votation) {
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // Verificar permisos (solo owner o edit)
      const isOwner = votation.ownerId.toString() === userId.toString();
      const member = await AdminMemberByVotationModel.findOne({ 
        votationid: votationId,
        invitedUserId: userId,
        status: "ACCEPTED",
        ROLES: "EDIT"
      }).lean();

      if (!isOwner && !member) {
        return res.status(403).json({
          ok: false,
          message: "No tienes permisos para ver estadísticas"
        });
      }

      // ===========================================
      // SOLO CÁLCULOS ESTADÍSTICOS
      // ===========================================
      const [
        totalQuestions,
        totalAnswers,
        totalParticipants,
        answersLast7Days
      ] = await Promise.all([
        QuestionModel.countDocuments({ votationId, isActive: true }),
        AnswerModel.countDocuments({ votationId }),
        AnswerModel.distinct("userId", { votationId }).then(users => users.length),
        this.getAnswersByDay(votationId)
      ]);

      // Calcular métricas
      const completionRate = totalQuestions > 0 && totalParticipants > 0
        ? Number(((totalAnswers / (totalQuestions * totalParticipants)) * 100).toFixed(1))
        : 0;

      const averageAnswersPerQuestion = totalQuestions > 0
        ? Number((totalAnswers / totalQuestions).toFixed(1))
        : 0;

      const averageAnswersPerParticipant = totalParticipants > 0
        ? Number((totalAnswers / totalParticipants).toFixed(1))
        : 0;

      return res.json({
        ok: true,
        data: {
          votation: {
            id: votation._id,
            subject: votation.subject,
            status: new Date(votation.closes_at) > new Date() ? 'active' : 'closed'
          },
          metrics: {
            totalQuestions,
            totalAnswers,
            totalParticipants,
            completionRate,
            averageAnswersPerQuestion,
            averageAnswersPerParticipant,
            answersLast7Days
          }
        }
      });

    } catch (err) {
      console.error("Error en VotationStatsController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener estadísticas"
      });
    }
  };

  async getAnswersByDay(votationId) {
    if (!votationId) {
      throw new Error("VotationID no proporcionado");
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const answers = await AnswerModel.aggregate([
      {
        $match: {
          votationId: new mongoose.Types.ObjectId(votationId),
          created_at: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Rellenar días faltantes con 0
    const result = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const found = answers.find(a => a._id === dateStr);
      result.unshift({
        date: dateStr,
        count: found ? found.count : 0
      });
    }

    return result;
  }
}