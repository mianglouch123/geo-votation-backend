// controllers/auth/forgot.password.controller.js
import { request, response } from "express";
import { UserModel } from "../../models/user.model.js";
import { PasswordResetTokenModel } from "../../models/password.reset.verification.token.model.js";
import { MailService } from "../../services/mail.service.js";
import { generateToken } from "../../helpers/token.helper.js";

// POST /api/auth/forgot-password
export class ForgotPasswordController {
  run = async (req = request, res = response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          ok: false,
          message: "Email es requerido"
        });
      }

      const user = await UserModel.findOne({ email }).lean();

      // Por seguridad, no revelamos si el email existe o no
      if (!user) {
        return res.json({
          ok: true,
          message: "Si el email existe, recibirás un enlace de recuperación"
        });
      }

      const token = generateToken();

      // ✅ CORREGIDO: deleteOne (no deletOne)
      await PasswordResetTokenModel.deleteOne({ email });

      await PasswordResetTokenModel.create({
        email,
        token
      });

      const mailService = new MailService();
      mailService.sendPasswordResetEmail(email, token).catch(err => {
      console.error("Error enviando email:", err);
     // Podrías guardar en una cola de reintentos aquí
     });
      return res.json({
        ok: true,
        message: "Si el email existe, recibirás un enlace de recuperación"
      });

    } catch (err) {
      console.error("Error en ForgotPasswordController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al procesar la solicitud"
      });
    }
  };
}