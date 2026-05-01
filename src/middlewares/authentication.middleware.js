import "dotenv/config"
import mongoose from "mongoose";
import jsonwebtoken from "jsonwebtoken";
import { request, response } from "express";
import { UserModel } from "../models/user.model.js";
import { BlacklistedTokenModel } from "../models/black.listed.token.model.js";

export class SessionMiddleware {

  run = async (req = request, res = response, next) => {

    try {

      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({
          ok: false,
          message: "Token de autenticacion no proporcionado"
        });
      }

      const blacklisted = await BlacklistedTokenModel.findOne({ token }).lean();

      if (blacklisted) {
      return res.status(401).json({
       ok: false,
       message: "Token inválido (sesión cerrada)"
      });
   
     }

     
      const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);

      const userId = decoded.userId;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(401).json({
          ok: false,
          message: "Token de autenticación inválido"
        });
      }

      const user = await UserModel
        .findById(userId)
        .select("-password")
        .lean();

      if (!user) {
        return res.status(401).json({
          ok: false,
          message: "Usuario no encontrado"
        });
      }

      if (!user.isVerfied) {
        return res.status(403).json({
          ok: false,
          message: "Usuario no verificado"
        });
      }

     req.userId = user._id;  // ← Más claro que req._id


      req.user = {
        _id: user._id,
        email: user.email,
        isVerfied: user.isVerfied
      };

      req.token = {
        iat: decoded.iat,
        exp: decoded.exp
      };

      next();

    } catch (error) {

       if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          ok: false,
          message: "Token de autenticación expirado",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          ok: false,
          message: "Token inválido",
        });
      }

      return res.status(500).json({
        ok: false,
        message: "Error interno del servidor",
      });
    }
  };

}
