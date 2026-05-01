import { Router } from "express";
import { AuthorizateUserController } from "../../controllers/access-verificators/authorizate.user.js";

const authorizateUserRouter = Router();

const authorizateUserController = new AuthorizateUserController();

authorizateUserRouter.get("/verify-code/:code", authorizateUserController.run);

export { authorizateUserRouter };


