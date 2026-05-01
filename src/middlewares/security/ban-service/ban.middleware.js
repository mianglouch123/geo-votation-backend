import { banService } from "./ban.service.js";


export const banMiddleware = (req, res, next) => {
  
  const ip = req.ip;
  if(!banService.checkIp(ip)) {
      return res.status(403).json({
      ok: false,
      message: 'Acceso denegado'
    });
  }
  res.on("finish" , () => {
    if(res.statusCode === 429) {
      banService.registerViolations(ip);

    }
  })
  next();

}