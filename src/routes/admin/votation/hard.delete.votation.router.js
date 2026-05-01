import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { DeleteVotationController } from "../../../controllers/admin/votation/hard.delete.votation.controller.js";

const hardDeleteVotationRouter = Router();

hardDeleteVotationRouter.delete("/votations/:votationId",
  new SessionMiddleware().run,
  new DeleteVotationController().run  // ← SIN PARÉNTESIS
);

export { hardDeleteVotationRouter };