import { Router } from "express";
import { RefreshTokenController } from "../../controllers/auth/refresh.token.auth.js";

const refreshTokenRouter = Router();
refreshTokenRouter.post("/auth/refresh-token",
new RefreshTokenController().run
);

export { refreshTokenRouter };