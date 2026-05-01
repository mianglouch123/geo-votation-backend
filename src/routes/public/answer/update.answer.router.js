import { Router } from "express";
import { UpdateAnswerController } from "../../../controllers/public/answer/update.answer.controller.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { sensitiveLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";

const updateAnswerRouter = Router();

updateAnswerRouter.put("/votations/:votationId/update-answers",
sensitiveLimiter,
new SessionMiddleware().run,
new UpdateAnswerController().run
);

export { updateAnswerRouter };
