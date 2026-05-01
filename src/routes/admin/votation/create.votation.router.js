import { Router } from "express";
import { CreateVotationController } from "../../../controllers/admin/votation/create.votation.controller.js";
import { SessionMiddleware } from "../../../middlewares/authentication.middleware.js";

const createVotationRouter = Router();

// ✅ Orden correcto: Middleware → Controlador
createVotationRouter.post(
  "/create-votation", 
  new SessionMiddleware().run,              // ← Primero verifica autenticación
  new CreateVotationController().run  // ← Luego ejecuta el controlador
);

export { createVotationRouter };