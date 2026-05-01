import { Router } from "express";
import { ResetPasswordController } from "../../controllers/auth/reset.password.auth.js";

const resetPassWordRouter = Router();

resetPassWordRouter.post("/auth/reset-password", new ResetPasswordController().run);

export { resetPassWordRouter };