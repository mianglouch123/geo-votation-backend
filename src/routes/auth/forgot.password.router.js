import { Router } from "express";
import { ForgotPasswordController } from "../../controllers/auth/forgot.password.auth.js";

const forgotPasswordRouter = Router();

forgotPasswordRouter.post("/auth/forgot-password",
new ForgotPasswordController().run
)

export { forgotPasswordRouter }

