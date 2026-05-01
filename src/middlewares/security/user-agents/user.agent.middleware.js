export const userAgentMiddleware = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  // Bloquear User-Agent vacío o muy corto
  if (!userAgent || userAgent.length < 10) {
    return res.status(403).json({
      ok: false,
      message: 'Acceso denegado'
    });
  }
  
  // Lista negra de bots maliciosos conocidos
  const badBots = [
    'curl', 'wget', 'python-requests', 'scrapy',
    'phantomjs', 'selenium', 'headless'
  ];
  
  if (badBots.some(bot => userAgent.toLowerCase().includes(bot))) {
    return res.status(403).json({
      ok: false,
      message: 'Acceso denegado'
    });
  }
  
  next();
};