import express, { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';  // ← AGREGAR
import { SystemEnv } from "../enviorments/system.js";
import { appRouter } from '../routes/app.router.js';

export class AppServer {

  /** @type {express.Application} */
  #app
  #systemEnv

  constructor() {
    this.#app = express();
    this.#systemEnv = SystemEnv.getInstance();
    this.#middlewares();
    this.#loadRoutes();
  }

  #middlewares() {
    // ===========================================
    // 1️⃣ HELMET - Headers de seguridad (PRIMERO)
    // ===========================================
    this.#app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", this.#systemEnv.API_URL],
        }
      },
    xssFilter: true,        // Protege contra XSS
    noSniff: true,          // Evita MIME sniffing
    hidePoweredBy: true,    // Oculta tu tecnología
    frameguard: { action: 'deny' }  // Previene clickjacking
    }));

    // ===========================================
    // 2️⃣ CORS - Configuración de orígenes
    // ===========================================
    this.#app.use(cors({
      origin: ["http://localhost:3000", "http://localhost:5173"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "DELETE", "PATCH", "PUT"],
    }));

    // ===========================================
    // 3️⃣ LIMITACIÓN DE PAYLOAD
    // ===========================================
    this.#app.use(express.json({ limit: '30mb' }));
    this.#app.use(express.urlencoded({ extended: true, limit: '30mb' }));

    // ===========================================
    // 4️⃣ TUS MIDDLEWARES GLOBALES (los que ya tienes)
    // ===========================================
    // Nota: Estos están en appRouter, pero puedes agregarlos aquí también
  }

  #loadRoutes() {
    const router = Router();
    router.use(appRouter);
    this.#app.use(router);
  }

  start() {
    const { API_PORT } = this.#systemEnv;
    this.#app.listen(API_PORT, async () => {
      try {
        console.log(`🚀 Server running on port ${API_PORT}`);
        console.log(`🔒 Helmet security headers enabled`);
        console.log(`🔐 CORS enabled for: http://localhost:3000, http://localhost:5173`);
      } catch (error) {
        console.error('Error starting the server:', error);
        process.exit(1);
      }
    });
  }
}