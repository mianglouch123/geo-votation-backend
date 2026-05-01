import rateLimit from 'express-rate-limit';

// Límite global para toda la API
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // máximo 100 peticiones por minuto por IP
  standardHeaders: true, // Devuelve headers RateLimit-*
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Demasiadas peticiones. Intenta de nuevo en 1 minuto.'
  }
});

// Límite estricto para autenticación
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  skipSuccessfulRequests: true, // No cuenta si la petición fue exitosa
  message: {
    ok: false,
    message: 'Demasiados intentos. Cuenta bloqueada por 15 minutos.'
  }
});

export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30, // 30 intentos por 1 hora
  message: {
    ok: false,
    message: 'Has excedido el límite de operaciones sensibles.'
  }
});