import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { GetRolesUserByVotationController } from "../../../controllers/admin/votation/get.roles.user.by.votation.controller.js";

const getRolesUserByVotationRouter = Router();

getRolesUserByVotationRouter.get("/votations/:votationId/role",
globalLimiter,
new SessionMiddleware().run,
new GetRolesUserByVotationController().run
);

export { getRolesUserByVotationRouter };