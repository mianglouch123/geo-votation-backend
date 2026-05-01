// controllers/notifications/delete.notification.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { NotificationModel } from "../../../models/notification.model.js";

// DELETE /api/notifications/:notificationId
export class DeleteNotificationController {
  run = async (req = request, res = response) => {
    try {
      const { notificationId } = req.params;
      const userId = req.userId;

      // 1️⃣ Validar ID
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de notificación inválido"
        });
      }

      // 2️⃣ Eliminar (asegurando que pertenece al usuario)
      const result = await NotificationModel.deleteOne({
        _id: notificationId,
        userId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "Notificación no encontrada"
        });
      }

      return res.json({
        ok: true,
        message: "Notificación eliminada correctamente"
      });

    } catch (err) {
      console.error("Error en DeleteNotificationController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al eliminar notificación"
      });
    }
  };
}