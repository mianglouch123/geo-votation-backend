import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { VotationStatsController } from "../../../controllers/admin/votation/votation.stats.controller.js";


const votationStatsRouter = Router();

votationStatsRouter.get("/votations/:votationId/stats",
new SessionMiddleware().run,
new VotationStatsController().run
);

export { votationStatsRouter };