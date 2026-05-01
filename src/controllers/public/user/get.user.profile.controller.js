// controllers/user/get.user.profile.controller.js
import { request, response } from "express";
import { UserModel } from "../../../models/user.model.js";
import { VotationModel } from "../../../models/votation.model.js";
import { AdminMemberByVotationModel } from "../../../models/admin.member.votation.model.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /api/user/profile
export class GetUserProfileController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;

      // 1️⃣ Obtener datos del usuario (protegido)
      const user = await dbBreaker.call(
        () => UserModel.findById(userId).select("-password").lean(),
        fallBacksBreaker.fallbackNull
      );

      if (!user) {
        return res.status(404).json({
          ok: false,
          message: "Usuario no encontrado"
        });
      }

      // 2️⃣ Estadísticas adicionales (protegidas)
      const [totalVotationsCreatedResult, totalVotationsParticipatingResult] = await Promise.all([
        dbBreaker.call(
          () => VotationModel.countDocuments({ ownerId: userId }),
          fallBacksBreaker.fallBackZero
        ),
        dbBreaker.call(
          () => AdminMemberByVotationModel.countDocuments({
            invitedUserId: userId,
            status: "ACCEPTED"
          }),
          fallBacksBreaker.fallBackZero
        ),
      ]);

      const totalVotationsCreated = totalVotationsCreatedResult;
      const totalVotationsParticipating = totalVotationsParticipatingResult;

      // 3️⃣ Votaciones donde ha respondido (protegido)
      const totalAnswersResult = await dbBreaker.call(
        async () => {
          const result = await AnswerModel.aggregate([
            { $match: { userId } },
            { $group: { _id: "$votationId" } },
            { $count: "total" }
          ]);
          return result[0]?.total || 0;
        },
        fallBacksBreaker.fallBackZero
      );

      const totalCountAnswers = totalAnswersResult;

      // 4️⃣ Respuesta con perfil enriquecido
      return res.json({
        ok: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            isVerified: user.isVerfied,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          },
          stats: {
            votationsCreated: totalVotationsCreated,
            votationsParticipating: totalVotationsParticipating,
            totalAnswers: totalCountAnswers,
            totalVotations: totalVotationsCreated + totalVotationsParticipating
          }
        }
      });

    } catch (err) {
      console.error("Error en GetUserProfileController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener perfil de usuario"
      });
    }
  };
}