import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { request, response } from "express";

import { UserModel } from "../../models/user.model.js";
import { TokenSchemaModel } from "../../models/token.model.js";
import { MailService } from "../../services/mail.service.js";
import { generateToken } from "../../helpers/token.helper.js";

export class RegisterController {

  run = async (req = request, res = response) => {

    const session = await mongoose.startSession();

    try {

      const { email, password } = req.body;

      // Validación básica
      if (!email || !password) {
        return res.status(400).json({
          ok: false,
          message: "Email y password son requeridos"
        });
      }

       session.startTransaction();

      // Verificar si el usuario ya existe
      const existingUser = await UserModel
        .findOne({ email })
        .session(session);

      if (existingUser) {
        await session.abortTransaction();
        session.endSession();

        return res.status(409).json({
          ok: false,
          message: "El email ya está en uso"
        });
      }

      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const newUser = await new UserModel({
        email,
        password: hashedPassword,
        isVerfied: false
      }).save({ session });

      // Generar token de verificación
      const verificationToken = generateToken();

      await new TokenSchemaModel({
        userId: newUser._id,
        token: verificationToken
      }).save({ session });

      // Generar JWT (coherente con SessionMiddleware)
      const authToken = jwt.sign(
        { userId: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      // Confirmar transacción
      await session.commitTransaction();

      // Enviar email después del commit

      const mailService = new MailService();
      mailService.sendEmail(email, verificationToken).catch(err => {
      console.error("Error enviando email:", err);
     // Podrías guardar en una cola de reintentos aquí
     });

      return res.status(201).json({
        ok: true,
        message: "Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.",
        token: authToken
      });

    } catch (err) {

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      session.endSession();

      console.error("Error en Register controller:", err);

      return res.status(500).json({
        ok: false,
        message: "Error interno del servidor"
      });
    }

    finally {
    session.endSession();
    }
  };
}
