// controllers/notifications/mark.all.notifications.read.controller.js

import { request, response } from "express";
import { NotificationModel } from "../../../models/notification.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";
// PUT /api/notifications/read-all

export class MarkAllNotificationsReadController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;

      // 1️⃣ Validar que hay usuario
      if (!userId) {
        return res.status(401).json({
          ok: false,
          message: "Usuario no autenticado"
        });
      }

      // 2️⃣ Contar cuántas no leídas hay antes (opcional, para mensaje)
      const unreadCount = await dbBreaker.call(
       () => NotificationModel.countDocuments({
        userId,
        read: false
      }),
       fallBacksBreaker.fallBackZero
      );

      // 3️⃣ Si no hay no leídas, responder rápido
      if (unreadCount === 0) {
        return res.json({
          ok: true,
          message: "No hay notificaciones pendientes por leer",
          data: {
            modifiedCount: 0,
            unreadCount: 0
          }
        });
      }
      
      // 4️⃣ Actualizar todas las notificaciones no leídas
      const result = await dbBreaker.call(
       () => NotificationModel.updateMany(
        { 
          userId,
          read: false 
        },
        { 
          $set: { read: true } 
        }
      ),
       fallBacksBreaker.fallBackZero
      );

      const modifiedCount = result?.modifiedCount || 0;

      // 5️⃣ Respuesta exitosa
      return res.json({
        ok: true,
        message: `${modifiedCount} notificaciones marcadas como leídas`,
        data: {
          modifiedCount: modifiedCount,
          unreadCount: 0,
          previousUnreadCount: unreadCount
        }
      });

    } catch (err) {
      console.error("Error en MarkAllNotificationsReadController:", err);
      
      return res.status(500).json({
        ok: false,
        message: "Error al marcar notificaciones como leídas",
        error: err.message
      });
    }
 };
}