import { Router } from "express";
import { sensitiveLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { MarkNotificationReadController } from "../../../controllers/public/notification/mark.a.notification.as.read.controller.js";

const markNotificationAsReadRouter = Router();

markNotificationAsReadRouter.put("/user/notification/:notificationId/read",
sensitiveLimiter,
new SessionMiddleware().run,
new MarkNotificationReadController().run
);

export { markNotificationAsReadRouter };