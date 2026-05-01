// controllers/admin/hard.delete.votation.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { QuestionModel } from "../../../models/question.model.js";
import { QuestionConfigModel } from "../../../models/question.config.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";

// DELETE /api/admin/votations/:votationId
export class DeleteVotationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { votationId } = req.params;
      const userId = req.userId;

      // 1️⃣ Validar ID
      if (!mongoose.Types.ObjectId.isValid(votationId) || !votationId) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      session.startTransaction();

      // 2️⃣ Buscar la votación (para verificar permisos)
      const votation = await VotationModel.findById(votationId).session(session);

      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Verificar permisos (solo el owner puede eliminar)
      if (votation.ownerId.toString() !== userId.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          ok: false,
          message: "Solo el propietario puede eliminar esta votación"
        });
      }

      // 4️⃣ Obtener todas las preguntas de esta votación
      const questions = await QuestionModel.find({ votationId }).session(session);
      const questionIds = questions.map(q => q._id);

      // 5️⃣ ELIMINAR EN ORDEN (respetando dependencias)

      // Primero: respuestas (dependen de preguntas)
      if (questionIds.length > 0) {
        await AnswerModel.deleteMany({ 
          questionId: { $in: questionIds } 
        }).session(session);
      }

      // Segundo: configuraciones de preguntas
      if (questionIds.length > 0) {
        await QuestionConfigModel.deleteMany({ 
          questionId: { $in: questionIds } 
        }).session(session);
      }

      // Tercero: preguntas
      await QuestionModel.deleteMany({ votationId }).session(session);

      // Cuarto: miembros de la votación
      await AdminMemberByVotationModel.deleteMany({ 
        votationid: votationId 
      }).session(session);

      // Quinto: la votación misma
      await VotationModel.deleteOne({ _id: votationId }).session(session);

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Votación eliminada permanentemente",
        data: {
          id: votationId,
          subject: votation.subject,
          deletedAt: new Date()
        }
      });

    } catch (err) {
      console.error("Error en HardDeleteVotationController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al eliminar la votación"
      });

    } finally {
      await session.endSession();
    }
  };
}