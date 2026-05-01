import mongoose from "mongoose";
import { request, response } from "express";
import { AnswerInputSchema, BulkAnswersInputSchema } from "../../../zod-validators/answer/form-validators/answer.input.schema.validator.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { QuestionTypeConfigSchemas } from "../../../zod-validators/question/type-validators/question.index.js";
import { QuestionModel } from "../../../models/question.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";
import { VotationModel } from "../../../models/votation.model.js";
import { UserModel } from "../../../models/user.model.js";
import { MailService } from "../../../services/mail.service.js";

// POST /public/votations/:votationId/submit-answer
export class SubmitAnswerController {
  
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { answers } = req.body;
      session.startTransaction();

      
      const parseAnswer = BulkAnswersInputSchema.safeParse({ answers });
      if (!parseAnswer.success) {
        return res.status(400).json({
          ok: false,
          message: "Formato de respuestas inválido",
          errors: parseAnswer.error.errors
        });
      }
      
      const answerToInsert = [];
      const errors = [];
    
      let votationId = parseAnswer?.data?.answers[0]?.votationId;
      let votation = null;
      
      try {
        votation = await dbBreaker.call(() => VotationModel.findById(new mongoose.Types.ObjectId(votationId)) ,async () => {
          throw new Error("Votacion no encontrada");
        })
      } 
      catch(err) {
        if(err?.message === "Votacion no encontrada") {
          await session.abortTransaction();
          return res.status(404).json({ ok : false , message : "Votación no encontrada" , votationId : String(votationId) });
        }
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

        // 🔥 Verificar que la pregunta existe (protegido con Circuit Breaker)
        let question;
        try {
          question = await dbBreaker.call(
            () => QuestionModel.findOne({
              _id: answerData.questionId,
              votationId: answerData.votationId,
              version: answerData.questionVersion
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
            error: "Pregunta no encontrada o versión incorrecta"
          });
          continue;
        }

        // ✅ VALIDACIÓN CLAVE: El value debe cumplir el schema del tipo
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

        // AGRUPAR DATOS AL CORREO - Formato que espera sendAnswerSummaryEmail
        bodyHTML.questions.push({
          label: question?.label,
          type: question?.type,
          value: answerData.value
        })

        if(answerData.userId && !bodyHTML.userId) {
          bodyHTML.userId = answerData.userId;
        }

        answerToInsert.push({
          userId: answerData.userId,
          votationId: answerData.votationId,
          questionId: answerData.questionId,
          questionVersion: answerData.questionVersion,
          value: answerData.value
        });
      }

      if (answerToInsert.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "No hay respuestas válidas",
          errors
        });
      }

      // 🔥 Insertar respuestas (protegido con Circuit Breaker)
      try {
        await dbBreaker.call(
          () => AnswerModel.insertMany(answerToInsert, { session }),
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

      const mailService = new MailService();
      const userId = bodyHTML.userId;
      
      if(!userId) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "El usuario no ha sido enviado.",
        });
      }
      
      let user = null;
      user = await dbBreaker.call(() => UserModel.findById(userId), fallBacksBreaker.fallbackNull)
      
      if(!user) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "El usuario no ha sido encontrado.",
        });
      }
 
      // Enviar email con el resumen de respuestas (no bloqueante, pero esperamos a que termine)
      await mailService.sendAnswerSummaryEmail(
        user?.email,           // TO
        user?.email.split('@')[0], // userName (toma la parte antes del @)
        bodyHTML.votationTitle,    // votationTitle
        bodyHTML.description,      // votationDescription
        bodyHTML.questions         // questions
      );

      await session.commitTransaction();

      return res.status(201).json({
        ok: true,
        message: `Respuestas guardadas: ${answerToInsert.length} exitosas`,
        data: {
          inserted: answerToInsert.length,
          ...(errors.length > 0 && {
            warnings: {
              count: errors.length,
              details: errors
            }
          })
        }
      });

    } catch(err) {
      console.error("Error en SubmitAnswerController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      
      return res.status(500).json({
        ok: false,
        message: "Error al enviar respuestas",
        error: err.message
      });
    } finally {
      await session.endSession();
    }
  };
} 