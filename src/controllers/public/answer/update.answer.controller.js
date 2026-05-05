import mongoose from "mongoose";
import { request, response } from "express";
import { AnswerInputSchema, BulkAnswersInputSchema } from "../../../zod-validators/answer/form-validators/answer.input.schema.validator.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { QuestionTypeConfigSchemas } from "../../../zod-validators/question/type-validators/question.index.js";
import { QuestionModel } from "../../../models/question.model.js";
import { VotationModel } from "../../../models/votation.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";
import { MailService } from "../../../services/mail.service.js";
import { UserModel } from "../../../models/user.model.js";

export class UpdateAnswerController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { answers } = req.body;
      
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "No hay respuestas para actualizar",
        });
      }

      const parserAnswer = BulkAnswersInputSchema.safeParse({ answers });
      if (!parserAnswer.success) {
        return res.status(400).json({
          ok: false,
          message: "Formato de respuestas inválido",
          errors: parserAnswer.error.errors
        });
      }

      session.startTransaction();

      const answersToUpdate = [];
      const answersToCreate = [];
      const errors = [];

      let votationId = parserAnswer?.data?.answers[0]?.votationId;
      let votation = null;

      try {
        votation = await dbBreaker.call(() => VotationModel.findById(new mongoose.Types.ObjectId(votationId)), async () => {
          throw new Error("Votacion no encontrada");
        });
      } catch(err) {
        if(err?.message === "Votacion no encontrada") {
          await session.abortTransaction();
          return res.status(404).json({ ok: false, message: "Votación no encontrada", votationId: String(votationId) });
        }
      }

      // Verificar si la votación está cerrada (una sola vez)
      const isVotationClosed = new Date(votation.closes_at) < new Date();
      if (isVotationClosed) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "La votación está cerrada, no se pueden actualizar respuestas"
        });
      }

      const bodyHTML = {
        votationTitle: votation.subject || "",
        subject: votation?.subject || "",
        description: votation?.description || "",
        questions: []
      }

      for (const answerData of answers) {
        const parseSingleAnswer = AnswerInputSchema.safeParse(answerData);

        if (!parseSingleAnswer.success) {
          errors.push({
            questionId: answerData.questionId,
            error: "Formato de respuesta inválido",
            details: parseSingleAnswer.error.errors
          });
          continue;
        }

        // 🔥 1. Buscar la pregunta
        let question;
        try {
          question = await dbBreaker.call(
            () => QuestionModel.findOne({
              _id: answerData.questionId,
              votationId: answerData.votationId,
              isActive: true
            }).session(session),
            fallBacksBreaker.fallbackNull
          );
        } catch (breakerErr) {
          await session.abortTransaction();
          return res.status(503).json({
            ok: false,
            message: "Servicio temporalmente no disponible. Intenta más tarde.",
            retryAfter: 30
          });
        }

        if (!question) {
          errors.push({
            questionId: answerData.questionId,
            error: "Pregunta no encontrada o inactiva en esta votación"
          });
          continue;
        }

        // 🔥 2. Validar el formato de la respuesta
        const validationResult = QuestionTypeConfigSchemas.safeParse({
          type: question.type,
          config: answerData.value
        });

        if (!validationResult.success) {
          errors.push({
            questionId: answerData.questionId,
            error: `Value no cumple el schema para tipo ${question.type}`,
            expected: question.type,
            details: validationResult.error.errors
          });
          continue;
        }

        // 🔥 3. Buscar si ya existe una respuesta
        let existingAnswer = null;
        try {
          existingAnswer = await dbBreaker.call(
            () => AnswerModel.findOne({
              userId: answerData.userId,
              votationId: answerData.votationId,
              questionId: answerData.questionId,
              questionVersion: question.version
            }).session(session),
            fallBacksBreaker.fallbackNull
          );
        } catch (breakerErr) {
          await session.abortTransaction();
          return res.status(503).json({
            ok: false,
            message: "Servicio temporalmente no disponible. Intenta más tarde.",
            retryAfter: 30
          });
        }

        // Agrupar datos para el email
        bodyHTML.questions.push({
          label: question?.label,
          type: question?.type,
          value: answerData.value
        });

        if(answerData.userId && !bodyHTML.userId) {
          bodyHTML.userId = answerData.userId;
        }

        // 🔥 4. Decidir si actualizar o crear
        if (existingAnswer) {
          answersToUpdate.push({
            filter: {
              userId: answerData.userId,
              votationId: answerData.votationId,
              questionId: answerData.questionId,
              questionVersion: question.version
            },
            update: {
              value: answerData.value
            }
          });
        } else {
          answersToCreate.push({
            userId: answerData.userId,
            votationId: answerData.votationId,
            questionId: answerData.questionId,
            questionVersion: question.version,
            value: answerData.value
          });
        }
      }

      // 🔥 5. Ejecutar actualizaciones
      if (answersToUpdate.length > 0) {
        try {
          for (const item of answersToUpdate) {
            await dbBreaker.call(
              () => AnswerModel.updateOne(
                item.filter,
                { $set: item.update },
                { session }
              ),
              fallBacksBreaker.fallbackEmptyArray
            );
          }
        } catch (breakerErr) {
          await session.abortTransaction();
          return res.status(503).json({
            ok: false,
            message: "Servicio temporalmente no disponible. Intenta más tarde.",
            retryAfter: 30
          });
        }
      }

      // 🔥 6. Insertar nuevas respuestas
      if (answersToCreate.length > 0) {
        try {
          await dbBreaker.call(
            () => AnswerModel.insertMany(answersToCreate, { session }),
            fallBacksBreaker.fallbackEmptyArray
          );
        } catch (breakerErr) {
          await session.abortTransaction();
          return res.status(503).json({
            ok: false,
            message: "Servicio temporalmente no disponible. Intenta más tarde.",
            retryAfter: 30
          });
        }
      }

      const totalProcessed = answersToUpdate.length + answersToCreate.length;

      // Enviar email (no bloqueante)
      const mailService = new MailService();
      const userId = bodyHTML.userId;
          
      if(userId) {
        let user = null;
        try {
          user = await dbBreaker.call(() => UserModel.findById(userId), fallBacksBreaker.fallbackNull);
        } catch(err) {
          console.error("Error buscando usuario:", err);
        }
        
        if(user) {
          mailService.sendAnswerUpdateSummaryEmail(
            user?.email,
            user?.email.split('@')[0],
            bodyHTML.votationTitle,
            bodyHTML.description,
            bodyHTML.questions
          ).catch(err => {
            console.error("Error enviando email:", err);
          });
        }
      }

      await session.commitTransaction();

      return res.status(200).json({
        ok: true,
        message: `Respuestas procesadas: ${totalProcessed} exitosas (${answersToUpdate.length} actualizadas, ${answersToCreate.length} nuevas)`,
        data: {
          updated: answersToUpdate.length,
          created: answersToCreate.length,
          ...(errors.length > 0 && {
            warnings: {
              count: errors.length,
              details: errors
            }
          })
        }
      });

    } catch (err) {
      console.error("Error en UpdateAnswerController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      
      return res.status(500).json({
        ok: false,
        message: "Error al actualizar respuestas",
        error: err.message
      });

    } finally {
      session.endSession();
    }
  };
}