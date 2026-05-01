import { Router } from "express";
import { sensitiveLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { DeleteNotificationController } from "../../../controllers/public/notification/delete.notification.id.controller.js";

const deleteNotificationRouter = Router();

deleteNotificationRouter.delete("/user/notification/:notificationId",
sensitiveLimiter,
new SessionMiddleware().run,
new DeleteNotificationController().run
);

export { deleteNotificationRouter };