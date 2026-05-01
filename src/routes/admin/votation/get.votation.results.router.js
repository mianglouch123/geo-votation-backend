import { Router } from "express";

import { GetVotationResultsController } from "../../../controllers/admin/votation/get.votation.results.controller.js";

import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
const getVotationResultsRouter = Router();

getVotationResultsRouter.get("/results/:votationId",
new SessionMiddleware().run,
new GetVotationResultsController().run

)

export { getVotationResultsRouter }