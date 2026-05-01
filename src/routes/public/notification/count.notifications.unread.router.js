import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { CountUnreadNotificationsController } from "../../../controllers/public/notification/count.notifications.unread.controller.js";

const countNotificationsUnreadRouter = Router();

countNotificationsUnreadRouter.get("/user/notifications-unread",
globalLimiter,
new SessionMiddleware().run,
new CountUnreadNotificationsController().run
);

export { countNotificationsUnreadRouter };