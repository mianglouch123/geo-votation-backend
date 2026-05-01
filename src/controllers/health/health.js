// controllers/health/health.controller.js
import mongoose from "mongoose";
import { request, response } from "express";

// GET /health
export class HealthController {
  run = async (req = request, res = response) => {
    const healthCheck = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      status: 'UP',
      services: {
        api: { status: 'UP' },
        database: { status: 'UP' }
      }
    };

    try {
      // Verificar conexión a MongoDB
      const dbState = mongoose.connection.readyState;
      
      switch (dbState) {
        case 0: // disconnected
          healthCheck.services.database.status = 'DOWN';
          healthCheck.services.database.message = 'Disconnected';
          healthCheck.status = 'DEGRADED';
          break;
        case 1: // connected
          healthCheck.services.database.status = 'UP';
          break;
        case 2: // connecting
          healthCheck.services.database.status = 'CONNECTING';
          healthCheck.status = 'DEGRADED';
          break;
        case 3: // disconnecting
          healthCheck.services.database.status = 'DISCONNECTING';
          healthCheck.status = 'DEGRADED';
          break;
        default:
          healthCheck.services.database.status = 'UNKNOWN';
      }

      // Si la BD está caída, devolver 503
      if (healthCheck.services.database.status !== 'UP') {
        return res.status(503).json(healthCheck);
      }

      return res.status(200).json(healthCheck);

    } catch (err) {
      healthCheck.status = 'DOWN';
      healthCheck.services.database.status = 'DOWN';
      healthCheck.services.database.error = err.message;
      
      return res.status(503).json(healthCheck);
    }
  };
}