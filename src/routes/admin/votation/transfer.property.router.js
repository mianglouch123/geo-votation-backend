import { Router } from "express";
import { TransferPropertyController } from "../../../controllers/admin/votation/transfer.property.controller.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
const transferPropertyRouter = Router();

transferPropertyRouter.post("/votations/:votationId/transfer-property",
new SessionMiddleware().run,
new TransferPropertyController().run
)

export { transferPropertyRouter }