import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { GetMyPendingInvitationsController } from "../../../controllers/public/invitation/get.my.pending.invitations.controller.js";

const getMyPendingInvitationsRouter = Router();

getMyPendingInvitationsRouter.get("/user/invitations/pending",
new SessionMiddleware().run,
new GetMyPendingInvitationsController().run
)

export { getMyPendingInvitationsRouter }