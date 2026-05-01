// controllers/notifications/get.notifications.controller.js
import { request, response } from "express";
import { NotificationModel } from "../../../models/notification.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";

// GET /user/notifications?page=1&limit=20&read=false
export class GetNotificationsController {
  run = async (req = request, res = response) => {
    try {
      const userId = req.userId;
      const { page = 1, limit = 20, read } = req.query;

      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.min(parseInt(limit), 50); // Máximo 50 por página
      const skip = (numericPage - 1) * numericLimit;

      // Construir query
      const query = { userId };
      if (read !== undefined) {
        query.read = read === 'true';
      }

      // Obtener notificaciones
      const [notifications, total] = await Promise.all([
        dbBreaker.call(
          () => NotificationModel.find(query)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(numericLimit)
            .lean(),
          fallBacksBreaker.fallbackEmptyArray
        ),
        dbBreaker.call(
          () => NotificationModel.countDocuments(query),
          fallBacksBreaker.fallBackZero
        )
      ]);

      // Enriquecer notificaciones con información del payload
      const enrichedNotifications = notifications.map(notif => ({
        _id: notif._id,
        action: notif.action,
        groupKey: notif.groupKey,
        count: notif.count,
        message: notif.last_message,
        read: notif.read,
        payload: notif.payload,
        createdAt: notif.created_at,
        updatedAt: notif.updated_at
      }));

      var totalUnreadNotifications = await dbBreaker.call(() => NotificationModel.countDocuments({ userId, read: false }), fallBacksBreaker.fallBackZero);
      var totalReadNotifications = await dbBreaker.call(() => NotificationModel.countDocuments({ userId, read: true }), fallBacksBreaker.fallBackZero);

      return res.json({
        ok: true,
        data: {
          notifications: enrichedNotifications,
          totalNotifications: total,
          totalUnreadNotifications: totalUnreadNotifications,
          totalReadNotifications: totalReadNotifications
        },
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          totalPages: Math.ceil(total / numericLimit),
          hasPrev: numericPage > 1,
          hasNext: numericPage < Math.ceil(total / numericLimit)
        }
      });

    } catch (err) {
      console.error("Error en GetNotificationsController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener notificaciones"
      });
    }
  };
}