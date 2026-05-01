// controllers/auth/reset.password.controller.js
import mongoose from "mongoose";  // ← IMPORTANTE
import { request, response } from "express";
import bcrypt from "bcrypt";
import { UserModel } from "../../models/user.model.js";
import { PasswordResetTokenModel } from "../../models/password.reset.verification.token.model.js";

// POST /api/auth/reset-password?token=123
export class ResetPasswordController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { token } = req.query;
      const { newPassword, confirmPassword } = req.body;
      
      // Validaciones
      if (!token) {
        return res.status(400).json({
          ok: false,
          message: "Token es requerido"
        });
      }

      if (!newPassword || !confirmPassword) {
        return res.status(400).json({
          ok: false,
          message: "Nueva contraseña y confirmación son requeridas"
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          ok: false,
          message: "Las contraseñas no coinciden"
        });
      }

      session.startTransaction();

      // Buscar token válido
      const resetToken = await PasswordResetTokenModel.findOne({ 
        token,
        expires: { $gt: new Date() }
      }).session(session);
      
      if (!resetToken) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Token inválido o expirado"
        });
      }
      
      // ✅ CORREGIDO: Sin lean() para poder guardar
      const user = await UserModel.findOne({ 
        email: resetToken.email 
      }).session(session);

      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Usuario no encontrado"
        });
      }
   
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      await user.save({ session });

      // Eliminar token usado
      await resetToken.deleteOne({ session });

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Contraseña actualizada correctamente"
      });

    } catch (err) {
      console.error("Error en ResetPasswordController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al restablecer contraseña"
      });

    } finally {
      await session.endSession();
    }
  };
}