import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { RemoveMemberController } from "../../../controllers/admin/votation/remove.member.controller.js";

const removeMemberRouter = Router();

removeMemberRouter.delete("/votations/:votationId/members/:userId",
new SessionMiddleware().run,
new RemoveMemberController().run
);

export { removeMemberRouter };