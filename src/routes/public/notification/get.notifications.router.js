import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { GetNotificationsController } from "../../../controllers/public/notification/get.notifications.controller.js";

const getNotificationsRouter = Router();

getNotificationsRouter.get("/user/notifications",
globalLimiter,
new SessionMiddleware().run,
new GetNotificationsController().run
);

export { getNotificationsRouter };