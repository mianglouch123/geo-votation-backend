import mongoose from "mongoose";
import { request , response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { NotificationActions } from "../../../zod-validators/notification/actions/notifications.actions.js";
import { notificationHandlers } from "../../../services/notifications/handlers/notifications.handler.js";
import { UserModel } from "../../../models/user.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";

// POST /api/admin/votations/:votationId/transfer-property

export class TransferPropertyController {
 
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
     
    try {
      const { votationId } = req.params;
      const { newOwnerEmail } = req.body;
      const oldOwnerId = req.userId;
      const oldOwnerEmail = req.user.email;

      // 1️⃣ Validaciones básicas
      if (!votationId || !newOwnerEmail) {
        return res.status(400).json({
          ok: false,
          message: "votationId y newOwnerEmail son requeridos"
        });
      }
     
      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      session.startTransaction();
    
      // 2️⃣ Verificar votación (como documento editable)
      const votation = await VotationModel.findById(votationId).session(session);
      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Verificar que el usuario actual es el dueño
      const ownerVotation = votation.ownerId.toString();
      if (ownerVotation !== oldOwnerId.toString()) {  
        await session.abortTransaction();
        return res.status(403).json({
          ok: false,
          message: "Se requiere ser propietario para transferir una propiedad"
        });
      }
    
      // 4️⃣ Verificar que el nuevo dueño existe (corregido: email como campo)
      const newOwner = await UserModel.findOne({ email: newOwnerEmail }).lean();
      if (!newOwner) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "El usuario no está registrado en el programa."
        });
      } 

      // 5️⃣ Verificar que el nuevo dueño es miembro de esta votación (corregido: con votationid)
      const memberRecord = await AdminMemberByVotationModel.findOne({ 
        votationid: votationId,
        invitedEmail: newOwnerEmail,
        status: "ACCEPTED"
      }).session(session);

      if (!memberRecord) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "El usuario no es miembro activo de esta votación"
        });
      }

      // 6️⃣ TRANSFERIR PROPIEDAD
      
      // Eliminar al nuevo dueño de members
      await AdminMemberByVotationModel.deleteOne({ 
        _id: memberRecord._id 
      }).session(session);

      // Agregar al antiguo dueño como miembro (con rol EDIT)
      await AdminMemberByVotationModel.create([{
        votationid: votationId,
        invitedEmail: oldOwnerEmail,
        invitedUserId: oldOwnerId,
        invitedByUserId: newOwner._id,
        ROLES: "EDIT",
        status: "ACCEPTED"
      }], { session });

      // Actualizar ownerId en votación
      votation.ownerId = newOwner._id;
      await votation.save({ session });
    
      // 7️⃣ NOTIFICACIONES (con await)
      
      // Al que transfiere
      const transferHandler = notificationHandlers[NotificationActions.TRANSFER_PROPERTY];
      if (transferHandler) {
        await transferHandler.execute({
          userId: oldOwnerId,
          action: NotificationActions.TRANSFER_PROPERTY,
          payload: {
            votationId: votation._id,
            votationTitle: votation.subject,
            newOwnerId: newOwner._id,
            newOwnerEmail: newOwner.email
          }
        });
      }

      // Al que recibe
      const receivedHandler = notificationHandlers[NotificationActions.RECEIVED_PROPERTY];
      if (receivedHandler) {
        await receivedHandler.execute({
          userId: newOwner._id,
          action: NotificationActions.RECEIVED_PROPERTY,
          payload: {
            votationId: votation._id,
            votationTitle: votation.subject,
            previousOwnerId: oldOwnerId,
            previousOwnerEmail: oldOwnerEmail
          }
        });
      }
    
      await session.commitTransaction();

      return res.status(200).json({
        ok: true,
        message: "Propiedad transferida correctamente",
        data: {
          votationId: votation._id,
          votationTitle: votation.subject,
          previousOwner: {
            id: oldOwnerId,
            email: oldOwnerEmail
          },
          newOwner: {
            id: newOwner._id,
            email: newOwner.email
          }
        }
      });
     
    } catch (err) {
      console.error("Error en TransferPropertyController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al transferir la propiedad"
      });

    } finally {
      session.endSession();
    }
  }
}