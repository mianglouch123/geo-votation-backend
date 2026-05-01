import { Router } from "express";
import { ResendEmailVerificationController } from "../../controllers/auth/resend.email.auth.js";

const resendEmailAuthRouter = Router();

resendEmailAuthRouter.post("/auth/resend-email-verification",
new ResendEmailVerificationController().run
);

export { resendEmailAuthRouter };

