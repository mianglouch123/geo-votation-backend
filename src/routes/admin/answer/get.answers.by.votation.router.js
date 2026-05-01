import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { GetVotationAnswersController } from "../../../controllers/admin/answer/get.answers.by.votation.controller.js";

const getAnswersByVotationRouter = Router();

getAnswersByVotationRouter.get("/votations/:votationId/answers",
new SessionMiddleware().run,
new GetVotationAnswersController().run

)
export { getAnswersByVotationRouter }
