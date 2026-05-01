import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { VotationsAnsweredController } from "../../../controllers/public/answer/votations.answered.controller.js";


const votationsAnsweredRouter = Router();

votationsAnsweredRouter.get("/user/votations/answered",
globalLimiter,
new SessionMiddleware().run,
new VotationsAnsweredController().run
);

export { votationsAnsweredRouter };