import { request, response } from "express";
import { PasswordResetTokenModel } from "../../../models/password.reset.verification.token.model.js";

// GET /api/auth/validate-reset-token?token=123
export class ValidateResetPasswordTokenController {
  run = async (req = request, res = response) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          ok: false,
          message: "Token es requerido"
        });
      }

      const resetToken = await PasswordResetTokenModel.findOne({
        token,
        expires: { $gt: new Date() } // Token no expirado
      });

      if (!resetToken) {
        return res.status(404).json({
          ok: false,
          message: "Token inválido o expirado"
        });
      }

      return res.json({
        ok: true,
        message: "Token válido",
        data: {
          email: resetToken.email
        }
      });

    } catch (err) {
      console.error("Error en ValidateResetTokenController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al validar token"
      });
    }
  };
}