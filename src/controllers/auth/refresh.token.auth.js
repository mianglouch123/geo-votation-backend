// controllers/auth/refresh.token.controller.js
import "dotenv/config";
import { request, response } from "express";
import jwt from "jsonwebtoken";
import { RefreshTokenModel } from "../../models/refresh.token.model.js";

// POST /api/auth/refresh-token
export class RefreshTokenController {
  run = async (req = request, res = response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          ok: false,
          message: "Refresh token requerido"
        });
      }

      // 1️⃣ Verificar refreshToken
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
      } catch (err) {
        return res.status(401).json({
          ok: false,
          message: "Refresh token inválido o expirado"
        });
      }

      // 2️⃣ Buscar el token en BD (que no esté revocado)
      const tokenDoc = await RefreshTokenModel.findOne({ 
        token: refreshToken,
        revoked: false 
      });

      if (!tokenDoc) {
        return res.status(401).json({
          ok: false,
          message: "Refresh token no encontrado o ya fue utilizado"
        });
      }

      // 3️⃣ Verificar expiración en BD
      if (new Date() > tokenDoc.expiresAt) {
        await tokenDoc.deleteOne();
        return res.status(401).json({
          ok: false,
          message: "Refresh token expirado"
        });
      }

      // 4️⃣ Generar NUEVO accessToken
      const newAccessToken = jwt.sign(
        { userId: decoded.userId },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      // 5️⃣ Generar NUEVO refreshToken (¡CORREGIDO!)
      const newRefreshToken = jwt.sign(
        { userId: decoded.userId },
        process.env.REFRESH_SECRET,  // ← Cambiado de REFRESH_TOKEN a REFRESH_SECRET
        { expiresIn: "7d" }
      );

      // 6️⃣ Marcar el anterior como revocado
      tokenDoc.revoked = true;
      await tokenDoc.save();

      // 7️⃣ Guardar el nuevo refreshToken
      await RefreshTokenModel.create({
        userId: decoded.userId,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      return res.json({
        ok: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      });

    } catch (err) {
      console.error("Error in refresh token controller", err);
      return res.status(500).json({
        ok: false,
        message: "Error interno al renovar token"
      });
    }
  };
}