import mongoose from "mongoose";
import { request, response } from "express";
import { NotificationModel } from "../../../models/notification.model.js";


// PUT /api/notifications/:notificationId/read
export class MarkNotificationReadController {
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

        // 2️⃣ Buscar la notificación
      const notification = await NotificationModel.findOne({
        _id: new mongoose.Types.ObjectId(notificationId),
        userId // Asegurar que la notificación pertenece al usuario
      });

      if (!notification) {
        return res.status(404).json({
          ok: false,
          message: "Notificación no encontrada"
        });
      }

       // 3️⃣ Si ya está leída, no hacer nada (pero no es error)
      if (notification.read) {
        return res.json({
          ok: true,
          message: "La notificación ya estaba marcada como leída",
          data: {
            id: notification._id,
            read: true
          }
        });
      }

          // 4️⃣ Marcar como leída
      notification.read = true;
      await notification.save();

      return res.json({
        ok: true,
        message: "Notificación marcada como leída",
        data: {
          id: notification._id,
          read: true,
          action: notification.action,
          groupKey: notification.groupKey
        }
      });

	}
    catch (err) {
      console.error("Error en MarkNotificationReadController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al marcar notificación como leída"
      });
    }
  }
}
