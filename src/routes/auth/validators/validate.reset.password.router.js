import { Router } from "express";
import { ValidateResetPasswordTokenController } from "../../../controllers/auth/validators/validate.reset.password.auth.js";

const validateResetPasswordRouter = Router();

validateResetPasswordRouter.get("/auth/validate-reset-token",
new ValidateResetPasswordTokenController().run,
)

export { validateResetPasswordRouter }