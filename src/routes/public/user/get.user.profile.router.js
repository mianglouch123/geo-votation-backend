import { Router } from "express";
import { GetUserProfileController } from "../../../controllers/public/user/get.user.profile.controller.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";

const getUserProfileRouter = Router();

getUserProfileRouter.get("/user/profile",
globalLimiter,
new SessionMiddleware().run,
new GetUserProfileController().run
);

export { getUserProfileRouter }