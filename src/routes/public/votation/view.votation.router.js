import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { ViewVotationController } from "../../../controllers/public/votation/view.votation.controller.js";
const viewVotationRouter = Router();

viewVotationRouter.get("/votations/:votationId/view-votation",
new SessionMiddleware().run,
new ViewVotationController().run

);

export { viewVotationRouter }