// controllers/user/change.password.controller.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { request, response } from "express";
import { UserModel } from "../../../models/user.model.js"
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";
// POST /api/user/change-password
export class ChangePasswordController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();
    
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.userId;

      // 1️⃣ Validaciones básicas
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          ok: false,
          message: "Todos los campos son requeridos"
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          ok: false,
          message: "Las contraseñas nuevas no coinciden"
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          ok: false,
          message: "La nueva contraseña debe ser diferente a la actual"
        });
      }

      session.startTransaction();

      // 2️⃣ Buscar usuario
      const user = await dbBreaker.call(
       () => UserModel.findById(userId).session(session),
       fallBacksBreaker.fallbackNull
      );

      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Usuario no encontrado"
        });
      }

      // 3️⃣ Verificar contraseña actual (VERSIÓN ASYNC)
      const isValidPassword = await bcrypt.compare(currentPassword, user.password); // ✅

      if (!isValidPassword) {
        await session.abortTransaction();
        return res.status(400).json({
          ok: false,
          message: "La contraseña actual es incorrecta"
        });
      }

      // 4️⃣ Hashear nueva contraseña
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // 5️⃣ Actualizar
      user.password = hashedPassword;
      await user.save({ session });

      await session.commitTransaction();

      return res.json({
        ok: true,
        message: "Contraseña actualizada correctamente"
      });

    } catch (err) {
      console.error("Error en ChangePasswordController:", err);
      
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error al cambiar la contraseña"
      });

    } finally {
      await session.endSession();
    }
  };
}