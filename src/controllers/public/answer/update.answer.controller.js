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
      
      // Validar que es un array
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "No hay respuestas para actualizar",
        });
      }

      // Validar estructura del bulk
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
      const errors = [];

      let votationId = parserAnswer?.data?.answers[0]?.votationId
      let votation = null;

      try {
		votation = await dbBreaker.call(() => VotationModel.findById(new mongoose. Types.ObjectId(votationId)) ,async () => {
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

        // 🔥 1. Verificar que la respuesta existe (protegido)
        let existingAnswer;
        try {
          existingAnswer = await dbBreaker.call(
            () => AnswerModel.findOne({
              userId: answerData.userId,
              votationId: answerData.votationId,
              questionId: answerData.questionId,
              questionVersion: answerData.questionVersion
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

        if (!existingAnswer) {
          errors.push({
            questionId: answerData.questionId,
            error: "Respuesta no encontrada para actualizar"
          });
          continue;
        }

        // 🔥 2. Verificar que la votación sigue abierta (protegido)
        let votation;
        try {
          votation = await dbBreaker.call(
            () => VotationModel.findById(answerData.votationId).session(session),
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

        if (!votation || new Date(votation.closes_at) < new Date()) {
          errors.push({
            questionId: answerData.questionId,
            error: "La votación está cerrada, no se puede actualizar"
          });
          continue;
        }

        // 🔥 3. Buscar la pregunta (protegido)
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

        // ✅ VALIDACIÓN ZOD (protege contra campos extra)
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

        answersToUpdate.push({
          filter: {
            userId: answerData.userId,
            votationId: answerData.votationId,
            questionId: answerData.questionId,
            questionVersion: answerData.questionVersion
          },
          update: {
            value: answerData.value
          }
        });
      }

      if (answersToUpdate.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "No hay respuestas válidas para actualizar",
          errors
        });
      }

      // 🔥 4. Ejecutar actualizaciones (protegido)
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

      await mailService.sendAnswerUpdateSummaryEmail(
        user?.email,           // TO
        user?.email.split('@')[0], // userName (toma la parte antes del @)
        bodyHTML.votationTitle,    // votationTitle
        bodyHTML.description,      // votationDescription
        bodyHTML.questions         // questions
      );

      await session.commitTransaction();

      return res.status(200).json({
        ok: true,
        message: `Respuestas actualizadas: ${answersToUpdate.length} exitosas`,
        data: {
          updated: answersToUpdate.length,
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