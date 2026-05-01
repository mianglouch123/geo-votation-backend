import { request, response } from "express";  // ← IMPORTANTE
import mongoose from "mongoose";
import { VotationModel } from "../../../../models/votation.model.js";
import { AnswerModel } from "../../../../models/answer.model.js";  // ← .js

// GET /api/export/votations/:votationId/answers/csv?page=1&limit=1000
export class ExportVotationAnswersPaginatedController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.params;
      const { page = 1, limit = 1000 } = req.query;

      if (!votationId) {
        return res.status(400).json({
          ok: false,
          message: "VotationId no enviada"
        });
      }

      // Validar que la votación existe
      const votation = await VotationModel.findById(votationId).lean();
      if (!votation) {
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // Paginación
      const numericPage = Math.max(parseInt(page), 1);
      const numericLimit = Math.max(parseInt(limit), 1);
      const skip = (numericPage - 1) * numericLimit;

      // Obtener respuestas paginadas
      const answers = await AnswerModel.find({ votationId })
        .populate('userId', 'email')
        .populate('questionId', 'label type')
        .skip(skip)
        .limit(numericLimit)
        .lean();

      // Generar CSV
      let csv = 'Usuario,Pregunta,Respuesta,Fecha\n';

      answers.forEach(ans => {
        const userEmail = ans.userId?.email || "Anónimo";
        const questionLabel = ans.questionId?.label || 'Desconocida';
        const answerValue = this.formatAnswerValue(ans.questionId, ans.value);
        
        csv += `"${userEmail}","${questionLabel}","${answerValue}","${ans.created_at}"\n`;
      });

      // Configurar headers para descarga
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=votation-${votationId}-answers-page-${numericPage}.csv`);

      res.send(csv);

    } catch (err) {
      console.error("Error exporting:", err);
      res.status(500).json({ 
        ok: false, 
        message: "Error al exportar" 
      });
    }
  };

  formatAnswerValue(question, value) {
    if (!question || !value) return "Sin respuesta";

    const type = question.type;

    switch (type) {
      case "MULTI_OPTION":
        if (!value.options) return "Formato inválido";
        
        const selected = value.options.filter(opt => opt.isChecked);
        if (selected.length === 0) return "Ninguna opción seleccionada";
        
        return selected.map(opt => opt.label).join('; ');

      case "SHORTANSWER":
      case "LARGEANSWER":
        if (value.value) return value.value;
        if (typeof value === 'string') return value;
        return JSON.stringify(value);

      case "HOUR":
        const hour = value.hour || '00';
        const min = value.min || '00';
        return `${hour}:${min}`;

      case "DATE":
        if (value.date) return value.date.split('T')[0];
        if (value.value) return value.value.split('T')[0];
        if (typeof value === 'string') return value.split('T')[0];
        return "Fecha inválida";

      default:
        return JSON.stringify(value);
    }
  }
}