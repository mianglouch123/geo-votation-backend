import { Router } from "express";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { ActivityController } from "../../../controllers/public/activity/activity.controller.js";

const activityRouter = Router();

activityRouter.get("/user/activity",
globalLimiter,
new SessionMiddleware().run,
new ActivityController().run
);

export { activityRouter }