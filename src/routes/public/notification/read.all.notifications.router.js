import { Router } from "express";
import { sensitiveLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { MarkAllNotificationsReadController } from "../../../controllers/public/notification/read.all.notifications.controller.js";

const readAllNotificationsRouter = Router();

readAllNotificationsRouter.put("/user/notifications/read-all",
sensitiveLimiter,
new SessionMiddleware().run,
new MarkAllNotificationsReadController().run
);

export { readAllNotificationsRouter };