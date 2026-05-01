import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { GetPendingInvitationsSentController } from "../../../controllers/admin/invitations/get.pending.invitations.sent.controller.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";

const getPendingInvitationsSentRouter = Router();

getPendingInvitationsSentRouter.get("/invitations/pending-sent" , 
globalLimiter,
new SessionMiddleware().run,
new GetPendingInvitationsSentController().run);

export { getPendingInvitationsSentRouter };