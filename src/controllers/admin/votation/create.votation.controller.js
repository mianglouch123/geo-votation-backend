import mongoose from "mongoose"
import { request , response } from "express";
import {QuestionModel} from "../../../models/question.model.js";
import { QuestionConfigModel } from "../../../models/question.config.js";	
import { VotationModel } from "../../../models/votation.model.js";
import { notificationHandlers } from "../../../services/notifications/handlers/notifications.handler.js";

import { VotationInputSchema } from "../../../zod-validators/votation/form-validators/votation.schema.js";
import { QuestionTypeConfigSchemas } from "../../../zod-validators/question/type-validators/question.index.js";


export class CreateVotationController {

  run = async (req = request, res = response) => {

    const session = await mongoose.startSession();

    try {

      const { votationData } = req.body;

      session.startTransaction();

      // 1️⃣ Validar votation completa
      const parseVotation = VotationInputSchema.safeParse(votationData);

      if (!parseVotation.success) {
        return res.status(400).json({
          ok : false,
          message: "Formato de votación inválido",
          errors: parseVotation.error
        });
      }

      const data = parseVotation.data;

      // 2️⃣ Validar ownerId
      if (!mongoose.Types.ObjectId.isValid(data.ownerId)) {
        return res.status(400).json({ message: "ID de propietario inválido" });
      }


     if(new Date(data.closes_at) < new Date()) {
      return res.status(400).json({ message: "La fecha de votación no puede ser en pasado." });

     }

      // 3️⃣ Crear votation
      const votation = await VotationModel.create([{
        ownerId: data.ownerId,
        subject: data.subject,
        description: data.description,
        closes_at: new Date(data.closes_at)
      }], { session });

      const createdVotation = votation[0];

      // 4️⃣ Crear preguntas
      for (const question of data.questions) {

        // 🔥 Validar config dependiendo del type
        const configValidation = QuestionTypeConfigSchemas.safeParse({
          type: question.type,
          config: question.config
        });

        if (!configValidation.success) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Config inválida para tipo ${question.type}`,
            errors: configValidation.error.errors
          });
        }

        // Crear Question
        const newQuestion = await QuestionModel.create([{
          votationId: createdVotation._id,
          label: question.label,
          code: question.code,
          type: question.type,
          isRequired: question.isRequired,
          version: 1,
          isActive: true
        }], { session });

        const createdQuestion = newQuestion[0];

        // Crear QuestionConfig
        await QuestionConfigModel.create([{
          votationId: createdVotation._id,
          questionId: createdQuestion._id,
          questionVersion: 1,
          config: question.config
        }], { session });

      }

      await session.commitTransaction();

      // 5️⃣ Notificación
      const handler = notificationHandlers["VOTATION_CREATED"];

      if (handler) {
        await handler.execute({
          userId: data.ownerId,
          action: "VOTATION_CREATED",
          payload: {
            votationId: createdVotation._id.toString(),
            votationTitle: createdVotation.subject,
            createdBy: data.ownerId
          }
        });
      }

      return res.status(201).json({
        message: "Votación creada correctamente",
        votationId: createdVotation._id
      });

    } catch (err) {

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error("Error creating votation:", err);

      return res.status(500).json({
        ok : false,
        message: "Internal server error"
      });

    } finally {
      session.endSession();
    }

  }

}
