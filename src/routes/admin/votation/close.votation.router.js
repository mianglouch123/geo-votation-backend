import { Router } from "express";

import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { CloseVotationController } from "../../../controllers/admin/votation/close.votation.controller.js";


const closeVotationRouter = Router();

closeVotationRouter.post("/votations/close",
new SessionMiddleware().run,
new CloseVotationController().run
)

export { closeVotationRouter }