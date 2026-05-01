// controllers/notifications/count.unread.notifications.controller.js
import { request, response } from "express";
import { NotificationModel } from "../../../models/notification.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /user/notifications/unread/count
export class CountUnreadNotificationsController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;

      const count = await dbBreaker.call(
        () => NotificationModel.countDocuments({
          userId,
          read: false
        }),
        fallBacksBreaker.fallBackZero
      );

      return res.json({
        ok: true,
        data: {
          unreadCount: count
        }
      });

    } catch (err) {
      console.error("Error en CountUnreadNotificationsController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al contar notificaciones"
      });
    }
  };
}