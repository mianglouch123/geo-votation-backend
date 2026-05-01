import { Router } from "express";
import { HealthController } from "../../controllers/health/health.js";

const healthRouter = Router();

healthRouter.get("/database/health" , new HealthController().run);
export { healthRouter }