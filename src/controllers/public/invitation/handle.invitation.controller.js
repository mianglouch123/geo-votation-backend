import mongoose from "mongoose";
import { request , response } from "express"
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";

//GET /api/user/invitations/:invitationId/handle

export class HandleInvitationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { invitationId } = req.params;
      const { action } = req.body; // "ACCEPT" o "REJECT"
      const userId = req.userId;
      const userEmail = req.user.email;

      console.log(invitationId);

      // 1️⃣ Validar acción
      if (!action || !["ACCEPT", "REJECT"].includes(action)) {
        return res.status(400).json({
          ok: false,
          message: "Acción inválida. Debe ser ACCEPT o REJECT"
        });
      }

      // 2️⃣ Validar ID
      if (!mongoose.Types.ObjectId.isValid(invitationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de invitación inválido"
        });
      }

      session.startTransaction();

      // 3️⃣ Buscar la invitación
      const invitation = await AdminMemberByVotationModel.findById(invitationId)
        .session(session);

      if (!invitation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Invitación no encontrada"
        });
      }

      // ✅ CORREGIDO: invitedEmail (no invitatedEmai)
      if (invitation.invitedEmail !== userEmail) {
        await session.abortTransaction();
        return res.status(403).json({
          ok: false,
          message: "Esta invitación no es para ti"
        });
      }

      if (invitation.status !== "PENDING") {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: `Esta invitación ya fue ${invitation.status.toLowerCase()}`
        });
      }

      if (action === "ACCEPT") {
        const votation = await VotationModel.findById(invitation.votationid)
          .lean()
          .session(session);

        if (!votation) {
          await session.abortTransaction();
          return res.status(404).json({
            ok: false,
            message: "La votación a la que fuiste invitado ya no existe"
          });
        }
      }

      const newStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";

      invitation.status = newStatus;

      // ✅ CORREGIDO: userId directo
      if (newStatus === "ACCEPTED") {
        invitation.invitedUserId = userId;  // ← Así viene del middleware
      }

      await invitation.save({ session });

      await session.commitTransaction();

      return res.status(200).json({
        ok: true,
        message: action === "ACCEPT" 
          ? "Invitación aceptada correctamente" 
          : "Invitación rechazada correctamente",
        data: {
          invitationId: invitation._id,
          status: newStatus,
          action: action.toLowerCase()
        }
      });

    } catch (err) {
      console.error("Error en HandleInvitationController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al procesar la invitación"
      });

    } finally {
      session.endSession();
    }
  }
}