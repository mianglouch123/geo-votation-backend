// utils/sanitizer.js
import xss from 'xss';

// Configuración personalizada
const xssOptions = {
  whiteList: {
    a: ['href', 'title', 'target', 'rel'],
    b: [],
    i: [],
    u: [],
    strong: [],
    em: [],
    p: ['class'],
    br: []
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false
};

export const sanitizeHTML = (str) => {
  if (!str || typeof str !== 'string') return str;
  return xss(str, xssOptions);
};

// Sanitizar objetos completos
export const sanitizeObject = (obj) => {
  if (!obj) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeHTML(value);
      } else if (typeof value === "object") {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return obj;
};