import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { HandleInvitationController } from "../../../controllers/public/invitation/handle.invitation.controller.js";

const handleInvitationRouter = Router();

handleInvitationRouter.put("/user/invitations/:invitationId/handle-invitation",
new SessionMiddleware().run,
new HandleInvitationController().run
)

export { handleInvitationRouter };