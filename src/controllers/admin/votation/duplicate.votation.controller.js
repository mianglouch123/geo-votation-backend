import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { QuestionModel } from "../../../models/question.model.js";
import { QuestionConfigModel } from "../../../models/question.config.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { notificationHandlers } from "../../../services/notifications/handlers/notifications.handler.js";

// POST /api/admin/votations/:votationId/duplicate
// Body: { newSubject, newDescription, newClosesAt }

export class DuplicateVotationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();

    try {
      const { votationId } = req.params;
      const { newSubject, newDescription, newClosesAt } = req.body;
      const userId = req.userId;
      const email = req.user.email;

      // Validaciones básicas
      if (!votationId) {
        return res.status(400).json({
          ok: false,
          message: "votación id necesaria"
        });
      }

      if (!newSubject || !newDescription || !newClosesAt) {
        return res.status(400).json({
          ok: false,
          message: "Parametros faltantes."
        });
      }

      // Validar fecha
      const parsedDate = new Date(newClosesAt);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          ok: false,
          message: "La fecha de cierre debe ser una fecha válida."
        });
      }

      session.startTransaction();

      // ✅ Obtener votación original
      const votation = await VotationModel.findById(votationId)
        .lean()
        .session(session);

      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "La Votación no existe"
        });
      }

      // Verificar permisos
      if (votation.ownerId.toString() !== userId?.toString()) {
        const member = await AdminMemberByVotationModel.findOne({
          votationid: votationId,
          invitedEmail: email,
          status: "ACCEPTED"
        }).lean().session(session);

        if (!member) {
          await session.abortTransaction();
          return res.status(404).json({
            ok: false,
            message: "No eres miembro de la votación"
          });
        }

        if (member.ROLES !== "EDIT") {
          await session.abortTransaction();
          return res.status(403).json({
            ok: false,
            message: "No tienes permisos para duplicar una votación."
          });
        }
      }

      // ✅ Crear nueva votación
      const [newVotation] = await VotationModel.create([{
        ownerId: userId,
        subject: newSubject,
        description: newDescription,
        closes_at: parsedDate
      }], { session });

      // ✅ Obtener preguntas originales (sin duplicados)
      const questions = await QuestionModel.find({ 
        votationId: votationId,
        isActive: true
      }).lean().session(session);

      // ✅ Control de duplicados usando Map
      const uniqueQuestions = new Map(); // key: código de pregunta, value: pregunta
      
      for (const question of questions) {
        const questionKey = question.code; // Usar el código como identificador único
        if (!uniqueQuestions.has(questionKey)) {
          uniqueQuestions.set(questionKey, question);
        }
      }

      const uniqueQuestionsList = Array.from(uniqueQuestions.values());
      console.log(`📋 Preguntas originales: ${questions.length}, Únicas: ${uniqueQuestionsList.length}`);

      // ✅ Crear nuevas preguntas y configuraciones
      const questionMap = new Map(); // originalId -> newQuestionId
      const processedCodes = new Set(); // Para evitar duplicados por código

      for (const originalQuestion of uniqueQuestionsList) {
        const questionCode = originalQuestion.code;
        
        // Verificar si ya procesamos este código
        if (processedCodes.has(questionCode)) {
          console.warn(`⚠️ Código duplicado detectado: ${questionCode}, omitiendo...`);
          continue;
        }
        
        // Verificar si ya existe una pregunta con el mismo código en la nueva votación
        const existingQuestion = await QuestionModel.findOne({
          votationId: newVotation._id,
          code: questionCode,
          isActive: true
        }).session(session);
        
        if (existingQuestion) {
          console.warn(`⚠️ Ya existe pregunta con código "${questionCode}" en la votación duplicada, omitiendo...`);
          processedCodes.add(questionCode);
          questionMap.set(originalQuestion._id.toString(), existingQuestion._id.toString());
          continue;
        }
        
        // Crear nueva pregunta
        const [newQuestion] = await QuestionModel.create([{
          votationId: newVotation._id,
          label: originalQuestion.label,
          code: originalQuestion.code,
          type: originalQuestion.type,
          isRequired: originalQuestion.isRequired,
          version: 1,
          isActive: true
        }], { session });
        
        // Obtener configuración original (última versión activa)
        const configs = await QuestionConfigModel.find({ 
          questionId: originalQuestion._id 
        })
          .sort({ questionVersion: -1 })
          .limit(1)
          .lean()
          .session(session);
        
        const originalConfig = configs[0];
        
        // Crear nueva configuración si no existe
        if (originalConfig) {
          const existingConfig = await QuestionConfigModel.findOne({
            questionId: newQuestion._id,
            questionVersion: 1
          }).session(session);
          
          if (!existingConfig) {
            await QuestionConfigModel.create([{
              votationId: newVotation._id,
              questionId: newQuestion._id,
              questionVersion: 1,
              config: originalConfig.config
            }], { session });
          }
        }
        
        processedCodes.add(questionCode);
        questionMap.set(originalQuestion._id.toString(), newQuestion._id.toString());
      }

      console.log(`✅ Duplicación completada: ${questionMap.size} preguntas procesadas`);

      // ✅ Notificación
      const handler = notificationHandlers["VOTATION_CREATED"];
      if (handler) {
        await handler.execute({
          userId: userId,
          action: "VOTATION_CREATED",
          payload: {
            votationId: newVotation._id.toString(),
            votationTitle: newVotation.subject,
            createdBy: userId,
            isDuplicate: true,
            originalVotationId: votationId
          }
        });
      }

      await session.commitTransaction();

      return res.status(201).json({
        ok: true,
        message: "Votación duplicada correctamente",
        data: {
          votationId: newVotation._id,
          subject: newVotation.subject,
          originalVotationId: votationId,
          questionsDuplicated: questionMap.size
        }
      });

    } catch (err) {
      console.error("Error en DuplicateVotationController:", err);

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al duplicar la votación",
        error: err.message
      });

    } finally {
      session.endSession();
    }
  };
}