import mongoose from "mongoose";
import { request , response } from "express"
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { NotificationActions } from "../../../zod-validators/notification/actions/notifications.actions.js";
import { notificationHandlers } from "../../../services/notifications/handlers/notifications.handler.js";
import { UserModel } from "../../../models/user.model.js";
import { VotationModel } from "../../../models/votation.model.js";
// POST /api/votations/:votationId/invite-user

export class InviteUserToVotationController {
 
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { votationId } = req.params;
      const { email, role } = req.body;
      const inviterId = req.userId;

      // 1️⃣ Validaciones básicas
      if (!email || !role) {
        return res.status(400).json({
          ok: false,
          message: "Email y rol son requeridos"
        });
      }

      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      session.startTransaction();

      // 2️⃣ Verificar votación
      const votation = await VotationModel.findById(votationId).lean().session(session);
      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Verificar permisos
      const ownerVotation = votation.ownerId.toString();
      if (ownerVotation !== inviterId.toString()) {
        // ✅ CORREGIDO: 'votationid' no 'votationId'
        const member = await AdminMemberByVotationModel.findOne({ 
          votationid: votation._id,  // ← Cambiado
          invitedUserId: inviterId,
          status: "ACCEPTED",
          ROLES: "EDIT"
        }).lean().session(session);

        if (!member) {
          await session.abortTransaction();
          return res.status(403).json({
            ok: false,
            message: "No tienes permisos para invitar a esta votación"
          });
        }  
      }
  
      // 4️⃣ Buscar usuario invitado
      const invitedUser = await UserModel.findOne({ email , isVerfied : true }).lean();
      if (!invitedUser) {
        await session.abortTransaction();
        return res.status(404).json({  // ← 404 es más apropiado
          ok: false,
          message: "El usuario no está registrado en el programa."
        });
      }

      // 5️⃣ Buscar invitación existente
      let invitation = await AdminMemberByVotationModel.findOne({
        votationid: votationId,
        invitedEmail: email
      }).session(session);

      const isNewInvitation = !invitation;

      if (invitation) {
        // ✅ ACTUALIZAR existente
        invitation.invitedEmail = email;
        invitation.invitedUserId = invitedUser._id;
        invitation.invitedByUserId = inviterId;  // ← CORREGIDO
        invitation.ROLES = role;  // ← El campo se llama ROLES (mayúsculas)
        invitation.status = "PENDING";
        
        await invitation.save({ session });
      } else {
        // ✅ CREAR nueva
        [invitation] = await AdminMemberByVotationModel.create([{
          votationid: votationId,
          invitedEmail: email,
          invitedUserId: invitedUser._id,
          invitedByUserId: inviterId,
          ROLES: role,
          status: "PENDING"
        }], { session });
      }
  
      // 6️⃣ NOTIFICACIÓN al invitado
      const actionToInvited = notificationHandlers["RECEIVED_INVITATION_VOTATION"];
      if (actionToInvited) {
        await actionToInvited.execute({  // ← Agregado await
          userId: invitedUser._id,
          action: NotificationActions.RECEIVED_INVITATION_VOTATION,
          payload: {
            votationId,
            votationTitle: votation.subject,
            invitedBy: inviterId,
            role,
            invitationId: invitation._id,
            isUpdated: !isNewInvitation
          }
        });
      }

      // 7️⃣ NOTIFICACIÓN al invitador (CORREGIDO)
      const actionToInviter = notificationHandlers["SEND_INVITATION_VOTATION"];
      if (actionToInviter) {
        await actionToInviter.execute({  // ← Agregado await
          userId: inviterId,
          action: NotificationActions.SEND_INVITATION_VOTATION,  // ← CORREGIDO
          payload: {
            votationId,
            votationTitle: votation.subject,
            invitedEmail: email,
            role,
            invitationId: invitation._id,
            isUpdated: !isNewInvitation
          }
        });
      } 
    
      await session.commitTransaction();

      return res.status(200).json({
        ok: true,
        message: isNewInvitation 
          ? `Invitación a votación ${votationId} enviada`
          : `Invitación a votación ${votationId} actualizada y reenviada`,
        data: {
          invitationId: invitation._id,
          invitedEmail: email,
          role,
          isUpdated: !isNewInvitation
        }
      });
   
    } catch (err) {
      console.error("Error en InviteUserToVotationController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      // Manejar error de índice único (en caso tal de que vuelvan a crear otro.)
      if (err.code === 11000) {
        return res.status(400).json({
          ok: false,
          message: "Error al procesar la invitación"
        });
      }

      return res.status(500).json({
        ok: false,
        message: "Error al enviar invitación"
      });

    } finally {
      session.endSession();
    }
  }
}