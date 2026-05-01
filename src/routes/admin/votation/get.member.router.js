import { Router } from "express";

import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { GetMembersController } from "../../../controllers/admin/votation/get.members.controller.js";

const getMembersRouter = Router();
getMembersRouter.get("/votations/:votationId/members",
new SessionMiddleware().run,
new GetMembersController().run
)

export { getMembersRouter }