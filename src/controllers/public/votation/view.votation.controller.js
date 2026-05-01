import mongoose from "mongoose";
import { request , response } from "express";
import { QuestionConfigModel } from "../../../models/question.config.js";
import { QuestionModel } from "../../../models/question.model.js";  // ← Faltaba .js
import { VotationModel } from "../../../models/votation.model.js";

// GET /public/votations/:votationId/view-votation

export class ViewVotationController {
 
  run = async( req = request , res = response ) => {
    try {
      const { votationId } = req.params;

      if(!votationId) {
        return res.status(400).json({
          ok: false,
          message: "votationID requerido.",
        });
      }
     
      if(!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "Votacion ID no es valido",
        });
      }
    
      // 2️⃣ Obtener votación
      const votation = await VotationModel.findById(votationId).lean();
      if(!votation) {
        return res.status(404).json({
          ok: false,
          message: `Votación: ${votationId} no encontrada.`,
        });
      }

      // 3️⃣ Verificar si está abierta
      const now = new Date();
      const closesAt = new Date(votation.closes_at);
      const isOpen = now < closesAt;  // ✅ Definir isOpen


      // 5️⃣ Obtener preguntas activas
      const questions = await QuestionModel.find({ 
        votationId, 
        isActive: true 
      }).lean();

      if (questions.length === 0) {
        return res.status(404).json({
          ok: false,
          message: "Esta votación no tiene preguntas activas",
        });
      }

      const questionIds = questions.map(q => q._id);
      
      // ✅ CORREGIDO: Sintaxis correcta de $in
      const configs = await QuestionConfigModel.find({ 
        questionId: { $in: questionIds } 
      }).lean();
      
      // ✅ CORREGIDO: Usar c.config, no q.config
      const configMap = new Map(
        configs.map(c => [c.questionId.toString(), c.config])
      );

      // 6️⃣ Armar respuesta
      const formData = {
        votation: {
          id: votation._id,
          subject: votation.subject,
          description: votation.description,
          closes_at: votation.closes_at,
          isOpen
        },

        questions: questions.map(q => ({
          id: q._id,
          code: q.code,
          label: q.label,
          type: q.type,
          isRequired: q.isRequired,
          version: q.version,
          config: configMap.get(q._id.toString()) || null  
        }))
      };
    
      return res.json({
        ok: true,
        message: isOpen 
          ? "Formulario obtenido correctamente" 
          : "La votación está cerrada (solo vista)",
        data: formData
      });

    } catch(err) {
      console.error("Error en ViewVotationController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener el formulario",
        error: err.message
      });
    }
  }
}