import { sanitizeObject } from "../santitizer.xss.js";

const safeAssign = (target, source) => {
  if (!target || !source) return;
  for (const key in target) delete target[key];
  Object.assign(target, source);
};

export const xssMiddleware = (req, res, next) => {
  try {
    if (req.body) safeAssign(req.body, sanitizeObject(req.body));
    if (req.query) safeAssign(req.query, sanitizeObject(req.query));
    if (req.params) safeAssign(req.params, sanitizeObject(req.params));

    next();
  } catch (err) {
    console.error("Error en xssMiddleware:", err);
    return res.status(400).json({
      ok: false,
      message: "Datos de entrada inválidos"
    });
  }
};