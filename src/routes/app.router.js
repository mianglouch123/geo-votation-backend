import { Router } from "express";
import { banMiddleware } from "../middlewares/security/ban-service/ban.middleware.js";
import { userAgentMiddleware } from "../middlewares/security/user-agents/user.agent.middleware.js";
import { sanitizerInputs } from "../middlewares/security/sanitizer/mongo/santiizer.mongo.js";
import { xssMiddleware } from "../middlewares/security/sanitizer/xss/middlewares/xss.middleware.js";
import { speedLimiter } from "../middlewares/slow-down/slow.down.middleware.js";


// Rutas
import { loginRouter } from "./auth/login.router.js";
import { registerRouter } from "./auth/register.router.js";
import { authorizateUserRouter } from "./access-verificators/authorizate.user.router.js";
import { createVotationRouter } from "./admin/votation/create.votation.router.js";
import { getVotationRouter } from "./admin/votation/get.votation.router.js";
import { getMembersRouter } from "./admin/votation/get.member.router.js";
import { duplicateVotationRouter } from "./admin/votation/duplicate.votation.router.js";
import { closeVotationRouter } from "./admin/votation/close.votation.router.js";
import { getVotationResultsRouter } from "./admin/votation/get.votation.results.router.js";
import { inviteUserToInvitationRouter } from "./admin/votation/invite.user.to.invitation.router.js";
import { transferPropertyRouter } from "./admin/votation/transfer.property.router.js";
import { getMyPendingInvitationsRouter } from "./public/invitation/get.my.pending.invitations.router.js";
import { handleInvitationRouter } from "./public/invitation/handle.invitation.router.js";
import { updateMemberRoleRouter } from "./admin/votation/update.member.role.router.js";
import { updateVotationRouter } from "./admin/votation/update.votation.router.js";
import { hardDeleteVotationRouter } from "./admin/votation/hard.delete.votation.router.js";
import { removeMemberRouter } from "./admin/votation/remove.member.router.js";
import { votationStatsRouter } from "./admin/votation/votations.stats.router.js";
import { viewVotationRouter } from "./public/votation/view.votation.router.js";
import { getAnswersByVotationRouter } from "./admin/answer/get.answers.by.votation.router.js";
import { exportVotationAnswersPaginatedRouter } from "./admin/answer/exports/export.answers.csv.router.js";
import { resendEmailAuthRouter } from "./auth/resend.email.auth.js";
import { refreshTokenRouter } from "./auth/refresh.token.router.js";
import { forgotPasswordRouter } from "./auth/forgot.password.router.js";
import { validateResetPasswordRouter } from "./auth/validators/validate.reset.password.router.js";
import { logoutAuthRouter } from "./auth/logout.auth.router.js";
import { resetPassWordRouter } from "./auth/reset.password.router.js";
import { healthRouter } from "./health/health.router.js";

import { getPendingInvitationsSentRouter } from "./admin/invitations/get.pending.invitations.sent.router.js";
import { declineInvitationSentRouter } from "./admin/invitations/decline.invitation.sent.router.js";
import { getMyVotationAnswersRouter } from "./public/answer/get.my.votation.answers.router.js";
import { submitAnswerRouter } from "./public/answer/submit.answer.router.js";
import { updateAnswerRouter } from "./public/answer/update.answer.router.js";
import { activityRouter } from "./public/activity/activity.router.js";
import { getUserVotationsByRawsRouter } from "./public/user/get.user.votations.by.raws.router.js";
import { dashboardRouter } from "./public/user/dashboard.router.js";
import { getUserProfileRouter } from "./public/user/get.user.profile.router.js";
import { changePasswordRouter } from "./public/user/change.password.router.js";
import { searchRouter } from "./search/search.router.js";
import { getNotificationsRouter } from "./public/notification/get.notifications.router.js";
import { countNotificationsUnreadRouter } from "./public/notification/count.notifications.unread.router.js";
import { markNotificationAsReadRouter } from "./public/notification/mark.notification.as.read.router.js";
import { deleteNotificationRouter } from "./public/notification/delete.notification.id.router.js";
import { readAllNotificationsRouter } from "./public/notification/read.all.notifications.router.js";
import { votationsAnsweredRouter } from "./public/answer/votations.answered.router.js";
import { getRolesUserByVotationRouter } from "./admin/votation/get.roles.user.by.votation.router.js";

const appRouter = Router();

// ===========================================
// MIDDLEWARES GLOBALES (TODAS LAS RUTAS)
// ===========================================
appRouter.use(userAgentMiddleware);      // Validar User-Agent
//appRouter.use(banMiddleware);            // Verificar IP no baneada
appRouter.use(sanitizerInputs)           // Sanatizar Inputs
appRouter.use(xssMiddleware);          // eliminar HTML peligroso (<script>)
appRouter.use(speedLimiter)              // Slow down (global)



// ===========================================
// DATABASE HEALTH
// ===========================================

appRouter.use(healthRouter)
// ===========================================

appRouter.use(authorizateUserRouter);
appRouter.use(validateResetPasswordRouter);
appRouter.use(loginRouter);
appRouter.use(registerRouter);
appRouter.use(resendEmailAuthRouter);
appRouter.use(refreshTokenRouter);
appRouter.use(forgotPasswordRouter);
appRouter.use(logoutAuthRouter);
appRouter.use(resetPassWordRouter);

// ===========================================
// RUTAS DE ADMIN (con sensitiveLimiter en operaciones de escritura)
// ===========================================
appRouter.use(createVotationRouter);           // POST
appRouter.use(getVotationRouter);              // GET (globalLimiter)
appRouter.use(getMembersRouter);               // GET (globalLimiter)
appRouter.use(duplicateVotationRouter);        // POST (sensitiveLimiter)
appRouter.use(closeVotationRouter);            // POST (sensitiveLimiter)
appRouter.use(getVotationResultsRouter);       // GET (globalLimiter)
appRouter.use(inviteUserToInvitationRouter);   // POST (sensitiveLimiter)
appRouter.use(transferPropertyRouter);         // POST (sensitiveLimiter)
appRouter.use(updateMemberRoleRouter);         // PUT (sensitiveLimiter)
appRouter.use(updateVotationRouter);           // PUT (sensitiveLimiter)
appRouter.use(hardDeleteVotationRouter);       // DELETE (sensitiveLimiter)
appRouter.use(removeMemberRouter);             // DELETE (sensitiveLimiter)
appRouter.use(votationStatsRouter);            // GET (globalLimiter)
appRouter.use(getRolesUserByVotationRouter)

// ===========================================
// RUTAS DE RESPUESTAS
// ===========================================
appRouter.use(getAnswersByVotationRouter);     // GET (globalLimiter)
appRouter.use(exportVotationAnswersPaginatedRouter); // GET (globalLimiter)


// ===========================================
// RUTAS DE INVITACIONES
// ===========================================

appRouter.use(getPendingInvitationsSentRouter); // GET (globalLimiter)
appRouter.use(declineInvitationSentRouter);  // PUT 


// ===========================================
// RUTAS PÚBLICAS
// ===========================================
appRouter.use(getMyPendingInvitationsRouter);    // GET (globalLimiter)
appRouter.use(handleInvitationRouter);          // POST (authLimiter)
appRouter.use(viewVotationRouter);             // GET (globalLimiter)
appRouter.use(getUserVotationsByRawsRouter)   // GET (globalLimiter)
appRouter.use(dashboardRouter)               // GET (globalLimiter)
appRouter.use(getUserProfileRouter)         // GET (globalLimiter)
appRouter.use(changePasswordRouter);        // POST (sensitiveLimiter)




// ===========================================
// RUTAS PÚBLICAS ANSWERS
// ===========================================
appRouter.use(getMyVotationAnswersRouter)      // GET (globalLimiter)   
appRouter.use(submitAnswerRouter)              // POST (sensitiveLimiter)
appRouter.use(updateAnswerRouter)              // PUT (sensitiveLimiter)
appRouter.use(votationsAnsweredRouter)      // GET (globalLimiter)   


// ===========================================
// RUTAS PÚBLICAS Activity
// ===========================================

appRouter.use(activityRouter)      // GET (globalLimiter)   


// ===========================================
// RUTAS SEARCH
// ===========================================
appRouter.use(searchRouter)      // GET (globalLimiter)


// ===========================================
// RUTAS NOTIFICATIONS
// ===========================================
appRouter.use(getNotificationsRouter)               // GET (globalLimiter)   
appRouter.use(countNotificationsUnreadRouter)      // GET (globalLimiter)   
appRouter.use(markNotificationAsReadRouter)      // PUT (sensitive limiter)   
appRouter.use(deleteNotificationRouter)         // DELETE (sensitive limiter)   
appRouter.use(readAllNotificationsRouter)         // DELETE (sensitive limiter)   


export { appRouter };

