import { Router } from "express";
import {RegisterController} from "../../controllers/auth/register.auth.js";

export const registerController = new RegisterController();
const registerRouter = Router();

registerRouter.post("/register", registerController.run);

export { registerRouter };

