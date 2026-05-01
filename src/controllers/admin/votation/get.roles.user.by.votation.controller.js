import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

export class GetRolesUserByVotationController {
  run = async (req = request, res = response) => {  
    try {
      const { votationId } = req.params;
      const userId = req.userId;

      if (!votationId) return res.status(400).json({ message: "Falta el ID de la votación" });
      if (!userId) return res.status(400).json({ message: "Falta el ID del usuario" });

      // ✅ Corregir: votation.ownerId, no votation.owner
      const votation = await dbBreaker.call(
        () => VotationModel.findById(votationId).lean(),
        fallBacksBreaker.fallbackNull
      );

      if (!votation) return res.status(404).json({ message: "Votación no encontrada" });

      const isOwner = votation.ownerId.toString() === userId.toString();

      if (isOwner) {
        return res.json({
          ok: true,
          data: {
            role: "OWNER",
            isOwner: true,
            canEdit: true,
            canInvite: true,
            canManageMembers: true,
            canTransfer: true,
            canDelete: true,
            canClose: true,
            canDuplicate: true
          }
        });
      }

      const member = await dbBreaker.call(
        () => AdminMemberByVotationModel.findOne({
          votationid: votationId,
          invitedUserId: userId,
          status: "ACCEPTED"
        }).lean(),
        fallBacksBreaker.fallbackNull
      );

      if (!member) {
        return res.status(403).json({ message: "No tienes acceso a esta votación" });
      }

      const isEdit = member.ROLES === "EDIT";

      return res.json({
        ok: true,
        data: {
          role: member.ROLES,
          isOwner: false,
          canEdit: isEdit,
          canInvite: isEdit,
          canManageMembers: false,
          canTransfer: false,
          canDelete: false,
          canClose: isEdit,
          canDuplicate: isEdit
        }
      });

    } catch (err) {
      console.error("Error en GetRolesUserByVotationController:", err);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  };
}