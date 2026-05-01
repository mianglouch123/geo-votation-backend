// controllers/answers/get.votation.answers.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { AnswerModel } from "../../../models/answer.model.js";
import { VotationModel } from "../../../models/votation.model.js";
import { QuestionModel } from "../../../models/question.model.js";
import { QuestionConfigModel } from "../../../models/question.config.js";
import { UserModel } from "../../../models/user.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/votations/:votationId/answers?page=1&limit=10&questionId=123&userId=456&searchEmail=juan
export class GetVotationAnswersController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.params;
      const { 
        page = 1, 
        limit = 10, 
        questionId, 
        userId,
        searchEmail  // ← NUEVO: parámetro para búsqueda por email
      } = req.query;

      // 1️⃣ Validar votationId
      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      // 2️⃣ Verificar que la votación existe
      const votation = await VotationModel.findById(votationId)
        .select("subject description")
        .lean();

      if (!votation) {
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Validar questionId si viene
      if (questionId && !mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de pregunta inválido"
        });
      }

      // 4️⃣ Validar userId si viene
      if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de usuario inválido"
        });
      }

      // ===========================================
      //  BÚSQUEDA POR EMAIL
      // ===========================================
      let finalQuery = { votationId };
      let searchMetadata = {};
      
      if (questionId) finalQuery.questionId = questionId;
      
      // Si hay searchEmail, buscar usuarios que coincidan
      if (searchEmail && searchEmail !== "undefined" && searchEmail.trim().length > 0) {
        const searchPage = parseInt(req.query.searchPage) || 1;
        const SEARCH_LIMIT = 50;
        const searchSkip = (searchPage - 1) * SEARCH_LIMIT;
        
        // Buscar usuarios por email (regex)
        const users = await dbBreaker.call(
          () => UserModel.find({
            email: { $regex: searchEmail, $options: 'i' }
          })
            .select("_id")
            .skip(searchSkip)
            .limit(SEARCH_LIMIT)
            .lean(),
          fallBacksBreaker.fallbackEmptyArray
        );
        
        const userIds = users.map(u => u._id.toString());

        const totalUsers = await UserModel.countDocuments({
         email: { $regex: searchEmail, $options: 'i' }
        });
 
        searchMetadata = {
         searchEmail,
         searchPage,
         searchLimit: SEARCH_LIMIT,
         totalUsers,
        totalSearchPages: Math.ceil(totalUsers / SEARCH_LIMIT)
       };

        
        if (userIds.length > 0) {
          finalQuery.userId = { $in: userIds };
        } else {
          // No hay usuarios que coincidan, retornar vacío
          return res.json({
            ok: true,
            data: {
              votation: {
                id: votationId,
                subject: votation.subject,
                description: votation.description
              },
              summary: {
                totalAnswers: 0,
                totalVoters: 0,
                totalParticipants: 0,
                participationPercentage: 0
              },
              filters: {
                questionId: questionId || null,
                searchEmail: searchEmail || null
              },
              questions: [],
              pagination: {
                page: 1,
                limit: parseInt(limit),
                total: 0,
                totalPages: 0,
                hasPrev: false,
                hasNext: false
              }
            }
          });
        }
      } else if (userId) {
        finalQuery.userId = userId;
      }

      // 6️⃣ Estadísticas generales
      const totalAnswers = await AnswerModel.countDocuments(finalQuery);
      const uniqueUsers = await AnswerModel.distinct("userId", finalQuery);
      const totalVoters = uniqueUsers.length;
      
      const allParticipants = await AnswerModel.distinct("userId", { votationId });
      const totalParticipants = allParticipants.length;

      // 7️⃣ Paginación
      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 1);
      const skip = (numericPage - 1) * numericLimit;

      // 8️⃣ Obtener respuestas paginadas
      const answers = await AnswerModel.find(finalQuery)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(numericLimit)
        .populate('userId', 'email')
        .lean();

      // 9️⃣ Obtener todas las preguntas de esta votación
      const questions = await QuestionModel.find({ 
        votationId,
        isActive: true 
      }).lean();

      const questionIds = questions.map(q => q._id.toString());

      // 🔟 Obtener configuraciones
      const configs = await QuestionConfigModel.find({
        questionId: { $in: questionIds }
      }).lean();

      const configMap = new Map(
        configs.map(c => [c.questionId.toString(), c.config])
      );

      // 1️⃣1️⃣ Agrupar respuestas por pregunta
      const answersByQuestion = {};
      answers.forEach(answer => {
        const qId = answer.questionId.toString();
        if (!answersByQuestion[qId]) answersByQuestion[qId] = [];
        answersByQuestion[qId].push(answer);
      });

      // 1️⃣2️⃣ Construir respuesta
      const questionsWithAnswers = questions.map(question => {
        const qId = question._id.toString();
        const questionAnswers = answersByQuestion[qId] || [];
        
        const formattedAnswers = questionAnswers.map(answer => ({
          id: answer._id,
          user: answer.userId ? {
            id: answer.userId._id,
            email: answer.userId.email
          } : { email: "Usuario anónimo" },
          value: this.formatAnswerValue(question, answer.value),
          version: answer.questionVersion,
          submittedAt: answer.created_at
        }));

        return {
          question: {
            id: question._id,
            label: question.label,
            code: question.code,
            type: question.type,
            isRequired: question.isRequired,
            version: question.version,
            isActive: question.isActive,
            config: configMap.get(qId) || {}
          },
          answers: formattedAnswers,
          totalAnswersForQuestion: questionAnswers.length
        };
      });

      // 1️⃣3️⃣ Calcular participación
      const participationPercentage = totalParticipants > 0
        ? Number(((totalVoters / totalParticipants) * 100).toFixed(1))
        : 0;

      const totalPages = Math.ceil(totalAnswers / numericLimit);


      return res.json({
        ok: true,
        data: {
          votation: {
            id: votationId,
            subject: votation.subject,
            description: votation.description
          },
          summary: {
            totalAnswers,
            totalVoters,
            totalParticipants,
            participationPercentage
          },
          filters: {
            questionId: questionId || null,
            userId: userId || null,
            searchEmail: searchEmail || null
          },
          questions: questionsWithAnswers,
          searchMetadata,
          pagination: {
            page: numericPage,
            limit: numericLimit,
            total: totalAnswers,
            totalPages,
            hasPrev: numericPage > 1,
            hasNext: numericPage < totalPages
          }
        }
      });

    } catch (err) {
      console.error("Error en GetVotationAnswersController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener respuestas"
      });
    }
  };

  formatAnswerValue(question, value) {
    if (!value) return null;

    switch (question.type) {
      case 'MULTI_OPTION':
        if (value.options) {
          return value.options
            .filter(opt => opt.isChecked)
            .map(opt => ({
              id: opt.id,
              label: opt.label
            }));
        }
        return value;

      case 'DATE':
        return value.date || value.value || value;

      case 'HOUR':
        if (value.hour) {
          return `${value.hour}:${value.min || '00'}`;
        }
        return value;

      default:
        return value.value || value;
    }
  }
}