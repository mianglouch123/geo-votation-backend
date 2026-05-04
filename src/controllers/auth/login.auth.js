// controllers/auth/login.controller.js
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { request, response } from "express";

import { UserModel } from "../../models/user.model.js";
import { TokenSchemaModel } from "../../models/token.model.js";
import { RefreshTokenModel } from "../../models/refresh.token.model.js";
import { MailService } from "../../services/mail.service.js";
import { generateToken } from "../../helpers/token.helper.js";

export class LoginController {
  run = async (req = request, res = response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          message: "Email y password son requeridos"
        });
      }

      const user = await UserModel.findOne({ email });

      if (!user) {
        return res.status(400).json({
          ok: false,
          message: "Usuario no encontrado"
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(400).json({
          ok: false,
          message: "Contraseña incorrecta"
        });
      }

      // Usuario NO verificado
      if (!user.isVerfied) {
        const existingToken = await TokenSchemaModel.findOne({
          userId: user._id
        });

        if (existingToken) {
          return res.status(400).json({
            ok: false,
            message: "Ya se ha enviado un correo de verificación. Revisa tu bandeja de entrada."
          });
        }

        const verificationToken = generateToken();

        await new TokenSchemaModel({
          userId: user._id,
          token: verificationToken
        }).save();

        const mailService = new MailService();
        mailService.sendEmail(user.email, verificationToken).catch(err => {
        console.error("Error enviando email:", err);
     // Podrías guardar en una cola de reintentos aquí
      });

        return res.status(403).json({
          ok: false,
          message: "Cuenta no verificada. Se ha enviado un nuevo correo de verificación."
        });
      }

      // Usuario verificado → generar tokens
      const authToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "5h" }
      );

      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_SECRET,
        { expiresIn: "7d" }
      );

      // Guardar refresh token en BD
      await RefreshTokenModel.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      });

      return res.status(200).json({
        ok: true,
        message: "Login exitoso",
        token: authToken,
        refreshToken: refreshToken,
      });

    } catch (err) {
      console.error("Error en Login controller:", err);
      return res.status(500).json({
        ok: false,
        message: "Error interno del servidor"
      });
    }
  };
}