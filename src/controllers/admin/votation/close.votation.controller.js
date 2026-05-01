import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js"; // ← Faltaba .js
import { notificationHandlers } from "../../../services/notifications/handlers/notifications.handler.js";

// /api/admin/votations/close
export class CloseVotationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    const BATCH_SIZE = 100; // ← Definir constante

    try {
      const { votationId } = req.body;
      const userId = req.userId;

      // Validaciones
      if (!votationId) {
        return res.status(400).json({ 
          ok: false, 
          message: "parametros faltantes." 
        });
      }
      
      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({ 
          ok: false, 
          message: "Votation ID invalido." 
        });
      }

      session.startTransaction();

      // ✅ Obtener votación (SIN lean() para poder hacer save)
      const votation = await VotationModel.findById(votationId).session(session);
      
      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({ 
          ok: false, 
          message: `Votacion ${votationId} no encontrada` 
        });
      }

      const now = new Date();
      const closesAt = new Date(votation.closes_at);

      if (now > closesAt) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "La votación ya está cerrada"
        });
      }

      // ✅ Actualizar fecha de cierre
      votation.closes_at = now;  // ← CORREGIDO
      await votation.save({ session });

      // ✅ Buscar miembros (corregido: votationid)
      const members = await AdminMemberByVotationModel.find({ 
        votationid: votationId,  // ← CORREGIDO
        status: "ACCEPTED"
      }).select("invitedUserId").lean();

      // ✅ Construir promesas de notificaciones por batches
      const notificationPromises = [];

      for (let i = 0; i < members.length; i += BATCH_SIZE) {
        const batch = members.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch
          .filter(b => b.invitedUserId) // Solo si tiene userId
          .map(b => {
            const handler = notificationHandlers["VOTATION_CLOSED"];
            if (handler) {
              return handler.execute({
                userId: b.invitedUserId,
                action: "VOTATION_CLOSED",
                payload: {
                  votationId: votation._id,
                  votationTitle: votation.subject,
                  closedBy: userId,
                  closedAt: now
                }
              });
            }
            return null;
          })
          .filter(p => p !== null); // Eliminar nulls

        notificationPromises.push(...batchPromises);
      }

      // ✅ Ejecutar todas las notificaciones
      if (notificationPromises.length > 0) {
        await Promise.all(notificationPromises);
      }

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Votación cerrada correctamente",
        data: {
          votationId: votation._id,
          subject: votation.subject,
          closedAt: now,
          originalCloseDate: closesAt
        }
      });

    } catch (err) {
      console.error("Error en CloseVotationController:", err);

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al cerrar la votación"
      });

    } finally {
      session.endSession();
    }
  };
}