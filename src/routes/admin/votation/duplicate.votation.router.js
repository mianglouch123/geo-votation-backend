import { Router } from "express";

import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { DuplicateVotationController } from "../../../controllers/admin/votation/duplicate.votation.controller.js";
const duplicateVotationRouter = Router();


duplicateVotationRouter.post("/votations/:votationId/duplicate",
new SessionMiddleware().run,
new DuplicateVotationController().run
)

export { duplicateVotationRouter }