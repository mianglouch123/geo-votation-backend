// middlewares/security/deepSanitize.js

/**
 * Sanitiza objetos profundamente, eliminando operadores MongoDB
 * y escapando caracteres peligrosos
 */


export const deepSanitize = (obj) => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }

  if (typeof obj === "object") {
    const sanitized = {};

    for (const key in obj) {

      // 🔴 BLOQUEAR operadores Mongo
      if (key.startsWith('$')) continue;

      // 🔴 BLOQUEAR prototype pollution
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;

      // 🔴 IMPORTANTE: bloquear "." en KEYS (no en values)
      const safeKey = key.replace(/\./g, '');

      sanitized[safeKey] = deepSanitize(obj[key]);
    }

    return sanitized;
  }

  // ✅ NO modificar strings
  return obj;
};

const safeAssign = (target, source) => {
  if (!target || !source) return;

  // limpiar objeto original
  for (const key in target) delete target[key];
  // copiar sanitizado
  Object.assign(target, source);
};

export const sanitizerInputs = (req, res, next) => {
  try {
    if (req.query) safeAssign(req.query, deepSanitize(req.query));
    if (req.params) safeAssign(req.params, deepSanitize(req.params));
    if (req.body) safeAssign(req.body, deepSanitize(req.body));

    next();
  } catch (err) {
    console.error('Error en sanitizerInputs:', err);
    return res.status(400).json({
      ok: false,
      message: 'Datos de entrada inválidos'
    });
  }
};