import { request, response } from "express";
import { UserModel } from "../../models/user.model.js";
import { TokenSchemaModel } from "../../models/token.model.js";

export class AuthorizateUserController {

  run = async (req = request, res = response) => {

    try {

      const { code } = req.params;

      if (!code) {
        return res.status(400).json({
          ok: false,
          message: "El código de verificación es requerido"
        });
      }

      const tokenDoc = await TokenSchemaModel.findOne({ token: code });

      if (!tokenDoc) {
        return res.status(404).json({
          ok: false,
          message: "Código inválido"
        });
      }

      if (new Date() > tokenDoc.expires) {

        await TokenSchemaModel.deleteOne({ _id: tokenDoc._id });

        return res.status(400).json({
          ok: false,
          message: "El código ha expirado"
        });
      }

      const user = await UserModel.findById(tokenDoc.userId);

      if (!user) {
        return res.status(400).json({
          ok: false,
          message: "Usuario no encontrado"
        });
      }

      // Si ya está verificado
      if (user.isVerfied) {

        await TokenSchemaModel.deleteOne({ _id: tokenDoc._id });

        return res.status(200).json({
          ok: true,
          message: "La cuenta ya estaba verificada"
        });
      }

      await UserModel.updateOne(
        { _id: tokenDoc.userId },
        { $set: { isVerfied: true } }
      );

      await TokenSchemaModel.deleteOne({ _id: tokenDoc._id });

      return res.status(200).json({
        ok: true,
        message: "Cuenta verificada exitosamente"
      });

    } catch (err) {

      return res.status(500).json({
        ok: false,
        message: "Error interno al verificar cuenta"
      });

    }
  };
}
