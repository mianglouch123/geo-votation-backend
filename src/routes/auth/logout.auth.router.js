import { Router } from "express";
import { LogoutController } from "../../controllers/auth/logout.auth.js";

const logoutAuthRouter = Router();

logoutAuthRouter.post("/auth/logout", new LogoutController().run);

export { logoutAuthRouter };