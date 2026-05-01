import { Router } from "express";
import { sensitiveLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { ChangePasswordController } from "../../../controllers/public/user/change.password.controller.js";

const changePasswordRouter = Router();

changePasswordRouter.post("/user/change-password",
sensitiveLimiter,
new SessionMiddleware().run,
new ChangePasswordController().run
);

export { changePasswordRouter };