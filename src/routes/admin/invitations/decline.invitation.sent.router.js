import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { DeclineSentInvitationController } from "../../../controllers/admin/invitations/decline.invitation.sent.controller.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";

const declineInvitationSentRouter = Router();

declineInvitationSentRouter.put("/decline-invitation-sent/:invitationId" , 
globalLimiter,
new SessionMiddleware().run,
new DeclineSentInvitationController().run);

export { declineInvitationSentRouter };