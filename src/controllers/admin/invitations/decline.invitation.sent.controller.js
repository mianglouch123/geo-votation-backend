import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { NotificationActions } from "../../../zod-validators/notification/actions/notifications.actions.js";
import { notificationHandlers } from "../../../services/notifications/handlers/notifications.handler.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";


// PUT /api/invitations/decline-invitation

export class DeclineSentInvitationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { invitationId } = req.params;
      const adminId = req.userId;

      // 1️⃣ Validaciones básicas
      if (!invitationId) {
        return res.status(400).json({
          ok: false,
          message: "ID de invitación es requerido"
        });
      }

      if (!mongoose.Types.ObjectId.isValid(invitationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de invitación inválido"
        });
      }

      session.startTransaction();

      // 2️⃣ Buscar la invitación
      const invitation = await AdminMemberByVotationModel.findById(invitationId)
        .session(session);

      if (!invitation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Invitación no encontrada"
        });
      }

      // 3️⃣ Verificar que el admin es quien envió la invitación
      if (invitation.invitedByUserId.toString() !== adminId.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          ok: false,
          message: "No tienes permiso para revocar esta invitación"
        });
      }

      // 4️⃣ Verificar que la invitación está pendiente
      if (invitation.status !== "PENDING") {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: `Esta invitación ya fue ${invitation.status.toLowerCase()}, no se puede revocar`
        });
      }

      // 5️⃣ Obtener datos de la votación (CORREGIDO)
      const votation = await dbBreaker.call(
   
        () => VotationModel.findById(invitation.votationid)
            .select("subject")
            .lean()
            .session(session) ,
        fallBacksBreaker.fallbackNull  // ← Necesitas crear este fallback
      )

      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: `La votación no existe: ${invitation.votationid}`
        });
      }

      // 6️⃣ ELIMINAR la invitación
      await AdminMemberByVotationModel.findByIdAndDelete(invitationId)
        .session(session);

      // 7️⃣ NOTIFICACIÓN al usuario invitado
      if (invitation.invitedUserId) {
        const notificationHandler = notificationHandlers["INVITATION_REVOKED"];
        if (notificationHandler) {
          await notificationHandler.execute({
            userId: invitation.invitedUserId,
            action: NotificationActions.INVITATION_REVOKED,
            payload: {
              votationId: invitation.votationid,
              votationTitle: votation?.subject || "Votación",
              invitedEmail: invitation.invitedEmail,
              revokedBy: adminId
            }
          });
        }
      }

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Invitación revocada correctamente",
        data: {
          invitationId: invitation._id,
          invitedEmail: invitation.invitedEmail,
          status: "REVOKED",
          votationId: invitation.votationid
        }
      });

    } catch (err) {
      console.error("Error en DeclineSentInvitationController:", err);

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al revocar la invitación"
      });

    } finally {
      session.endSession();
    }
  };
}