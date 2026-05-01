import { Router } from "express";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";
import { globalLimiter } from "../../../middlewares/rate-limiter/global.limiter.middleware.js";
import { GetUserVotationsByRawController } from "../../../controllers/public/user/get.user.votations.by.raws.controller.js";

const getUserVotationsByRawsRouter = Router();


// GET /api/user/votations?type=participation&type=created&type=answered&page=1&limit=10

getUserVotationsByRawsRouter.get("/user/votations-by-raw",
globalLimiter,
new SessionMiddleware().run,
new GetUserVotationsByRawController().run
);

export { getUserVotationsByRawsRouter }