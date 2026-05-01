import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { UpdateMemberRoleController } from "../../../controllers/admin/votation/update.member.role.controller.js";


const updateMemberRoleRouter = Router();

updateMemberRoleRouter.put("/votations/:votationId/members/:userId/role",
new SessionMiddleware().run,
new UpdateMemberRoleController().run
);

export { updateMemberRoleRouter };