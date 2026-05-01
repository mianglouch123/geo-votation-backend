// controllers/auth/logout.controller.js
import { request, response } from "express";
import jwt from "jsonwebtoken";
import { BlacklistedTokenModel } from "../../models/black.listed.token.model.js";
import { RefreshTokenModel } from "../../models/refresh.token.model.js";

// POST /api/auth/logout
export class LogoutController {
  run = async (req = request, res = response) => {
    try {
      const accessToken = req.header("Authorization")?.replace("Bearer ", "");
      const { refreshToken } = req.body;

      // Validaciones
      if (!accessToken) {
        return res.status(400).json({
          ok: false,
          message: "Access token no proporcionado"
        });
      }

      if (!refreshToken) {
        return res.status(400).json({
          ok: false,
          message: "Refresh token no proporcionado"
        });
      }

      // 1️⃣ Blacklist del accessToken
      const decoded = jwt.decode(accessToken);
      
      if (!decoded || !decoded.exp) {
        return res.status(400).json({
          ok: false,
          message: "Access token inválido"
        });
      }

      await BlacklistedTokenModel.create({
        token: accessToken,
        expiresAt: new Date(decoded.exp * 1000)
      });

      // 2️⃣ Revocar refreshToken en BD
      const result = await RefreshTokenModel.updateOne(
        { token: refreshToken },
        { $set: { revoked: true } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "Refresh token no encontrado"
        });
      }

      return res.json({
        ok: true,
        message: "Sesión cerrada correctamente"
      });

    } catch (err) {
      console.error("Error en LogoutController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al cerrar sesión"
      });
    }
  };
}