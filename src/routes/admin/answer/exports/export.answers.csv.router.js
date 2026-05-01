import { Router } from "express";
import { SessionMiddleware } from "../../../../middlewares/authentication.middleware.js";
import { ExportVotationAnswersPaginatedController } from "../../../../controllers/admin/answer/exports/export.answers.csv.controller.js";

const exportVotationAnswersPaginatedRouter = Router();

exportVotationAnswersPaginatedRouter.get("/export/votations/:votationId/answers/csv",
new SessionMiddleware().run,
new ExportVotationAnswersPaginatedController().run
)

export { exportVotationAnswersPaginatedRouter }