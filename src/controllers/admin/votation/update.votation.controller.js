import mongoose from "mongoose";
import { request, response } from "express";
import { QuestionModel } from "../../../models/question.model.js";
import { QuestionConfigModel } from "../../../models/question.config.js";
import { VotationModel } from "../../../models/votation.model.js";
import { VotationUpdateInputSchema } from "../../../zod-validators/votation/form-validators/votation.schema.js";
import { QuestionTypeConfigSchemas } from "../../../zod-validators/question/type-validators/question.index.js";

// PUT /api/admin/votations/update-votation
export class UpdateVotationController {
  run = async (req = request, res = response) => {
    const session = await mongoose.startSession();

    try {
      const { votationData } = req.body;


      // 1️⃣ Validar datos de entrada
      const parseVotation = VotationUpdateInputSchema.safeParse(votationData);
      if (!parseVotation.success) {
        return res.status(400).json({
          ok: false,
          message: "Formato de votación inválido",
          errors: parseVotation.error
        });
      }

      const data = parseVotation.data;
      session.startTransaction();

      // 2️⃣ Validar ID
      if (!mongoose.Types.ObjectId.isValid(data.votationId)) {
        return res.status(400).json({
          ok: false,
          message: "El votation Id enviado es inválido",
        });
      }

      // 3️⃣ Obtener votación
      const votation = await VotationModel.findById(data.votationId).session(session);
      if (!votation) {
        await session.abortTransaction();
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada",
        });
      }

      // 4️⃣ Actualizar campos básicos de votación
      const fields = {};
      const votationKeys = ["subject", "description", "closes_at"];

      for (const k of votationKeys) {
        if (data[k] !== votation[k]?.toString()) {
          if (k === "closes_at" && data["closes_at"]) {
            const parseDate = new Date(data["closes_at"]);
            if (isNaN(parseDate.getTime())) {
              await session.abortTransaction();
              return res.status(400).json({
                ok: false,
                message: "La fecha de cierre no es una fecha válida"
              });
            }
            if (parseDate < new Date()) {
              await session.abortTransaction();
              return res.status(400).json({
                ok: false,
                message: "La fecha de cierre no puede ser en pasado."
              });
            }
          }
          fields[k] = data[k];
        }
      }

      if (Object.keys(fields).length > 0) {
        await VotationModel.findByIdAndUpdate(
          votation._id,
          { $set: fields },
          { session }
        );
      }

      // 5️⃣ Obtener todas las preguntas activas actuales
      const existingQuestions = await QuestionModel.find({
        votationId: data.votationId,
        isActive: true
      }).session(session);

      const existingQuestionsMap = new Map(
        existingQuestions.map(q => [q._id.toString(), q])
      );

      const processedQuestions = [];

      // 6️⃣ Procesar cada pregunta del update
      for (const question of data.questions) {
        let findQuestion = null;

        // ✅ Si tiene questionId, buscar la pregunta existente
        if (question.questionId) {
          findQuestion = await QuestionModel.findOne({
            _id: question.questionId,
            votationId: data.votationId,
          }).session(session);
        }

        // ✅ Si NO tiene questionId o no se encontró, es una pregunta NUEVA
        const isNewQuestion = !findQuestion;

        if (isNewQuestion) {
          // 🆕 CREAR NUEVA PREGUNTA (versión 1)
          const [createdQuestion] = await QuestionModel.create([{
            votationId: votation._id,
            label: question.label,
            code: question.code,
            type: question.type,
            isRequired: question.isRequired,
            version: 1,
            isActive: true
          }], { session });

          await QuestionConfigModel.create([{
            votationId: votation._id,
            questionId: createdQuestion._id,
            questionVersion: 1,
            config: question.config
          }], { session });

          processedQuestions.push(createdQuestion._id.toString());
          continue;
        }

        // ✅ Validar configuración para preguntas existentes
        const configValidation = QuestionTypeConfigSchemas.safeParse({
          type: question.type,
          config: question.config
        });

        if (!configValidation.success) {
          await session.abortTransaction();
          return res.status(400).json({
            ok: false,
            message: `Config inválida para tipo ${question.type}`,
            errors: configValidation.error
          });
        }

        // Obtener configuración actual
        const currentConfig = await QuestionConfigModel.findOne({
          questionId: findQuestion._id
        }).session(session);

        // Detectar si necesita nueva versión
        const typeChanged = question.type !== findQuestion.type;
        const configChanged = JSON.stringify(currentConfig?.config) !==
                             JSON.stringify(question.config);

        if (typeChanged || configChanged) {
          // 🔄 VERSIONAMOS

          // Desactivar versión anterior
          findQuestion.isActive = false;
          await findQuestion.save({ session });

          // Crear nueva versión
          const newVersion = findQuestion.version + 1;
          const [createdQuestion] = await QuestionModel.create([{
            votationId: votation._id,
            label: question.label,
            code: question.code,
            type: question.type,
            isRequired: question.isRequired,
            version: newVersion,
            isActive: true
          }], { session });

          // Crear nueva configuración
          await QuestionConfigModel.create([{
            votationId: votation._id,
            questionId: createdQuestion._id,
            questionVersion: newVersion,
            config: question.config
          }], { session });

          processedQuestions.push(createdQuestion._id.toString());
        } else {
          // 📝 Solo actualizar campos no críticos
          const questionUpdates = {};
          if (findQuestion.label !== question.label) {
            questionUpdates.label = question.label;
          }
          if (findQuestion.code !== question.code) {
            questionUpdates.code = question.code;
          }
          if (findQuestion.isRequired !== question.isRequired) {
            questionUpdates.isRequired = question.isRequired;
          }

          if (Object.keys(questionUpdates).length > 0) {
            await QuestionModel.updateOne(
              { _id: findQuestion._id },
              { $set: questionUpdates },
              { session }
            );
          }

          // Actualizar config si cambió
          if (configChanged) {
            await QuestionConfigModel.updateOne(
              { questionId: findQuestion._id },
              { $set: { config: question.config } },
              { session }
            );
          }

          processedQuestions.push(findQuestion._id.toString());
        }

        // Marcar como procesada
        existingQuestionsMap.delete(question.questionId);
      }

      await session.commitTransaction();

      return res.status(200).json({
        ok: true,
        message: "Votación actualizada correctamente",
        data: {
          votationId: votation._id,
          updatedFields: Object.keys(fields),
          processedQuestions: processedQuestions.length
        }
      });

    } catch (err) {
      console.error("Error en UpdateVotationController:", err);

      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        ok: false,
        message: "Error interno del servidor"
      });

    } finally {
      session.endSession();
    }
  };
}