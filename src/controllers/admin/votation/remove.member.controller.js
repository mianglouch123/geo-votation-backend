import mongoose from "mongoose";
import { request, response } from "express";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { VotationModel } from "../../../models/votation.model.js";

// DELETE /api/admin/votations/:votationId/members/:userId
export class RemoveMemberController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();

    try {
      const { votationId, userId } = req.params;
      const ownerId = req.userId;

      // 1️⃣ Validar parámetros
      if (!votationId || !userId) {
        return res.status(400).json({
          ok: false,
          message: "votationId y userId son requeridos"
        });
      }

      if (!mongoose.Types.ObjectId.isValid(votationId) ||
          !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación o usuario inválido"
        });
      }

      session.startTransaction();

      // 2️⃣ Verificar que la votación existe
      const votation = await VotationModel.findById(votationId)
        .session(session);

      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Verificar que el usuario actual es el OWNER
      if (votation.ownerId.toString() !== ownerId.toString()) {
        await session.abortTransaction();  // ← AGREGADO
        return res.status(403).json({
          ok: false,
          message: "Solo el propietario puede eliminar miembros"
        });
      }

      // 4️⃣ Buscar el miembro a eliminar
      const member = await AdminMemberByVotationModel.findOne({
        votationid: votationId,
        invitedUserId: userId,
        status: "ACCEPTED"
      }).session(session);

      if (!member) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Miembro no encontrado en esta votación"
        });
      }

      // 5️⃣ No permitir eliminar al propio owner
      if (votation.ownerId.toString() === userId) {
        await session.abortTransaction();  // ← AGREGADO
        return res.status(400).json({
          ok: false,
          message: "No puedes eliminarte a ti mismo como propietario"
        });
      }

      // 6️⃣ Eliminar miembro
      await member.deleteOne({ session });  // ← Punto y coma

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Miembro eliminado correctamente",
        data: {
          votationId,
          userId: member.invitedUserId,
          email: member.invitedEmail,
          role: member.ROLES,
          removedAt: new Date()
        }
      });

    } catch (err) {
      console.error("Error en RemoveMemberController:", err);

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al eliminar miembro"
      });

    } finally {
      session.endSession();
    }
  };
}