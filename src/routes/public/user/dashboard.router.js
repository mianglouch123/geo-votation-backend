import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { DashboardController } from "../../../controllers/public/user/dashboard.controller.js";

const dashboardRouter = Router();

dashboardRouter.get("/user/dashboard",
globalLimiter,
new SessionMiddleware().run,
new DashboardController().run
);

export { dashboardRouter };