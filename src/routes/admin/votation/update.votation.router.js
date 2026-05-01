import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { UpdateVotationController } from "../../../controllers/admin/votation/update.votation.controller.js";

const updateVotationRouter = Router();

updateVotationRouter.put("/votations/update-votation" ,
new SessionMiddleware().run,
new UpdateVotationController().run
)

export { updateVotationRouter }