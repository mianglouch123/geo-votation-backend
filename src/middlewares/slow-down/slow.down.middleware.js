import slowDown from 'express-slow-down';

// Ralentiza peticiones cuando se acerca al límite
export const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 minuto
  delayAfter: 50, // empezar a ralentizar después de 50 peticiones
  delayMs: () => 500,// ← NUEVA SINTAXIS: función que retorna el delay 500 ms
  maxDelayMs: 5000, // máximo 5 segundos de retraso
  skipSuccessfulRequests: true
});