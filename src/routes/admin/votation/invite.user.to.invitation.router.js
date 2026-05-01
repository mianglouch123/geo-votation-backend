import { Router } from "express";
import { InviteUserToVotationController } from "../../../controllers/admin/votation/invite.user.to.invitation.by.id.controller.js";

import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";

const inviteUserToInvitationRouter = Router();

inviteUserToInvitationRouter.post("/votations/:votationId/invite-user",
new SessionMiddleware().run,
new InviteUserToVotationController().run

)

export { inviteUserToInvitationRouter }