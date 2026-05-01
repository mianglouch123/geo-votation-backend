// controllers/user/get.my.votation.answers.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { AnswerModel } from "../../../models/answer.model.js";
import { VotationModel } from "../../../models/votation.model.js";
import { QuestionModel } from "../../../models/question.model.js";
import { QuestionConfigModel } from "../../../models/question.config.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/user/votations/:votationId/my-answers?page=1&limit=10
export class GetMyVotationAnswersController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.params;
      const userId = req.userId;
      const { page = 1, limit = 50 } = req.query;

      // 1️⃣ Validar votationId
      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      // 2️⃣ Verificar que la votación existe (protegido)
      const votation = await dbBreaker.call(
        () => VotationModel.findById(votationId)
          .select("subject description closes_at")
          .lean(),
        fallBacksBreaker.fallbackNull
      );

      if (!votation) {
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Paginación
      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 1);
      const skip = (numericPage - 1) * numericLimit;

      // 4️⃣ Obtener todas las preguntas de la votación (protegido)
      const questions = await dbBreaker.call(
        () => QuestionModel.find({ 
          votationId,
          isActive: true 
        })
          .select("label code type isRequired version")
          .lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      if (questions.length === 0) {
        return res.status(404).json({
          ok: false,
          message: "La votación no tiene preguntas activas"
        });
      }

      const questionIds = questions.map(q => q._id.toString());

      // 5️⃣ Obtener configuraciones de las preguntas (protegido)
      const configs = await dbBreaker.call(
        () => QuestionConfigModel.find({
          questionId: { $in: questionIds }
        }).lean(),
        fallBacksBreaker.fallbackEmptyArray
      );

      const configMap = new Map(
        configs.map(c => [c.questionId.toString(), c.config])
      );

      // 6️⃣ Obtener respuestas del usuario en esta votación (protegido)
      const [answers, totalAnswers] = await Promise.all([
        dbBreaker.call(
          () => AnswerModel.find({
            userId,
            votationId
          })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
          fallBacksBreaker.fallbackEmptyArray
        ),
        dbBreaker.call(
          () => AnswerModel.countDocuments({ userId, votationId }),
          fallBacksBreaker.fallbackCount
        )
      ]);

      const totalCount = totalAnswers[0]?.total || 0;

      // 7️⃣ Mapear respuestas por questionId para fácil acceso
      const answersByQuestion = {};
      answers.forEach(answer => {
        answersByQuestion[answer.questionId.toString()] = answer;
      });

      // 8️⃣ Construir respuesta
      const questionsWithAnswers = questions.map(question => {
        const qId = question._id.toString();
        const answer = answersByQuestion[qId];

        return {
          question: {
            id: question._id,
            label: question.label,
            code: question.code,
            type: question.type,
            isRequired: question.isRequired,
            version: question.version,
            config: configMap.get(qId) || {}
          },
          answer: answer ? {
            id: answer._id,
            value: this.formatAnswerValue(question, answer.value),
            version: answer.questionVersion,
            submittedAt: answer.created_at
          } : null
        };
      });

      // 9️⃣ Calcular estadísticas
      const answeredCount = answers.length;
      const completionPercentage = (answeredCount / questions.length) * 100;
      const totalPages = Math.ceil(totalCount / numericLimit);

      return res.json({
        ok: true,
        data: {
          votation: {
            id: votationId,
            subject: votation.subject,
            description: votation.description,
            closesAt: votation.closes_at,
            isClosed: new Date(votation.closes_at) < new Date()
          },
          summary: {
            totalQuestions: questions.length,
            answeredQuestions: answeredCount,
            unansweredQuestions: questions.length - answeredCount,
            completionPercentage: Number(completionPercentage.toFixed(1))
          },
          questions: questionsWithAnswers,
          pagination: {
            page: numericPage,
            limit: numericLimit,
            total: totalCount,
            totalPages,
            hasPrev: numericPage > 1,
            hasNext: numericPage < totalPages
          }
        }
      });

    } catch (err) {
      console.error("Error en GetMyVotationAnswersController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener tus respuestas"
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
        if (value.date) {
          return new Date(value.date).toISOString().split('T')[0];
        }
        if (value.value) {
          return new Date(value.value).toISOString().split('T')[0];
        }
        return value;

      case 'HOUR':
        if (value.hour) {
          return {
            hour: value.hour,
            minute: value.min || '00',
            formatted: `${value.hour}:${value.min || '00'}`
          };
        }
        return value;

      case 'SHORTANSWER':
      case 'LARGEANSWER':
        return value.value || value;

      default:
        return value;
    }
  }
}