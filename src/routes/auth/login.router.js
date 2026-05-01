import { Router } from "express";
import { LoginController } from "../../controllers/auth/login.auth.js";


export const loginController = new LoginController();

const loginRouter = Router();

loginRouter.post("/login", loginController.run);

export { loginRouter };