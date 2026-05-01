import mongoose from "mongoose";
import { request, response } from "express";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { VotationModel } from "../../../models/votation.model.js";

// PUT /api/admin/votations/:votationId/members/:userId/role
// Body: { newRole: "EDIT" | "ONLYREAD" }
export class UpdateMemberRoleController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();

    try {
      const { votationId, userId } = req.params;
      const { newRole } = req.body;
      const adminId = req.userId;

      // 1️⃣ Validar parámetros
      if (!votationId || !userId) {
        return res.status(400).json({
          ok: false,
          message: "votationId y userId son requeridos"
        });
      }

      // ✅ CORREGIDO: validación de newRole
      if (!newRole || !["EDIT", "ONLYREAD"].includes(newRole)) {
        return res.status(400).json({
          ok: false,
          message: "Rol inválido. Debe ser EDIT o ONLYREAD"
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

      // 3️⃣ Verificar permisos del admin
      const isOwner = votation.ownerId.toString() === adminId.toString();
      if (!isOwner) {
        // ✅ CORREGIDO: campo votationid y session
        const adminMember = await AdminMemberByVotationModel.findOne({
          votationid: votationId,  // ← CORREGIDO
          invitedUserId: adminId,
          status: "ACCEPTED",
          ROLES: "EDIT"
        }).session(session).lean();

        if (!adminMember) {
          await session.abortTransaction();
          return res.status(403).json({
            ok: false,
            message: "No tienes permisos para modificar miembros"
          });
        }
      }

      // 4️⃣ Buscar el miembro a modificar
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

      // ✅ CORREGIDO: validación de propietario
      if (votation.ownerId.toString() === userId) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "No puedes modificar el rol del propietario"
        });
      }

      // 5️⃣ Actualizar rol
      const oldRole = member.ROLES;
      member.ROLES = newRole;
      await member.save({ session });

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Rol actualizado correctamente",
        data: {
          votationId,
          userId,
          oldRole,
          newRole,
          updatedAt: new Date()
        }
      });

    } catch (err) {
      console.error("Error en UpdateMemberRoleController:", err);

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al actualizar rol del miembro"
      });

    } finally {
      session.endSession();
    }
  };
}