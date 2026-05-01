import mongoose from "mongoose";
import { request, response } from "express";
import { MailService } from "../../services/mail.service.js";
import { generateToken } from "../../helpers/token.helper.js";
import { UserModel } from "../../models/user.model.js";
import { TokenSchemaModel } from "../../models/token.model.js";

// POST /api/auth/resend-email-verification


export class ResendEmailVerificationController {
  run = async (req = request, res = response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          ok: false,
          message: "Email es requerido"
        });
      }

      // 1️⃣ Buscar usuario
      const user = await UserModel.findOne({ email }).lean();

      // Por seguridad, no revelamos si el email existe
      if (!user) {
        return res.json({
          ok: true,
          message: "Si el email existe, recibirás un nuevo link de verificación"
        });
      }

      // 2️⃣ Verificar si ya está verificado
      if (user.isVerfied) {
        return res.status(400).json({
          ok: false,
          message: "La cuenta ya está verificada"
        });
      }

      // 3️⃣ Buscar y eliminar token anterior (si existe)
      const findToken = await TokenSchemaModel.findOne({ 
        userId: user._id  // ← CORREGIDO
      });

      if (findToken) {
        await findToken.deleteOne();
      }

      // 4️⃣ Generar nuevo token
      const token = generateToken();

      // 5️⃣ Guardar nuevo token
      await TokenSchemaModel.create({
        userId: user._id,
        token
      });

      // 6️⃣ Enviar nuevo email
      const mailService = new MailService();
      await mailService.sendEmail(email, token);

      return res.json({
        ok: true,
        message: "Si el email existe, recibirás un nuevo link de verificación"
      });

    } catch (err) {
      console.error("Error en ResendVerificationController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al reenviar verificación"
      });
    }
  };
}