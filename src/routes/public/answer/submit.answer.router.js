import { Router } from "express";
import { SubmitAnswerController } from "../../../controllers/public/answer/submit.answer.controller.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { sensitiveLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";

const submitAnswerRouter = Router();

submitAnswerRouter.post("/votations/:votationId/submit-answer",
sensitiveLimiter,
new SessionMiddleware().run,
new SubmitAnswerController().run
);

export { submitAnswerRouter }