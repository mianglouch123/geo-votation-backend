import { Router } from "express";

import { GetVotationController } from "../../../controllers/admin/votation/get.votation.controller.js";

import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";

const getVotationRouter = Router();


getVotationRouter.get("/get-votation/",
globalLimiter,
new SessionMiddleware().run,
new GetVotationController().run
)

export { getVotationRouter }