import { Router } from "express";
import { GetMyVotationAnswersController } from "../../../controllers/public/answer/get.my.votation.answers.controller.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";

const getMyVotationAnswersRouter = Router();

getMyVotationAnswersRouter.get("/votations/:votationId/my-answers",
globalLimiter,
new SessionMiddleware().run,
new GetMyVotationAnswersController().run,
);

export { getMyVotationAnswersRouter }