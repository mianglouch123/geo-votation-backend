// controllers/results/get.votation.results.controller.js
import mongoose from "mongoose";
import { request, response } from "express";
import { VotationModel } from "../../../models/votation.model.js";
import { QuestionModel } from "../../../models/question.model.js";
import { AnswerModel } from "../../../models/answer.model.js";
import { dbBreaker } from "../../../middlewares/circuit-breaker/circuit.breaker.js";
import { fallBacksBreaker } from "../../../middlewares/circuit-breaker/fallbacks.breaker.js";


// GET /api/results/:votationId?questionId=123
export class GetVotationResultsController {
  run = async (req = request, res = response) => {
    try {
      const { votationId } = req.params;
      const { questionId } = req.query; // ← Opcional

      // 1️⃣ Validar votationId
      if (!mongoose.Types.ObjectId.isValid(votationId)) {
        return res.status(400).json({
          ok: false,
          message: "ID de votación inválido"
        });
      }

      // 2️⃣ Obtener votación
      const votation = await VotationModel.findById(votationId)
        .select("subject description")
        .lean();

      if (!votation) {
        return res.status(404).json({
          ok: false,
          message: "Votación no encontrada"
        });
      }

      // 3️⃣ Si viene questionId, validar que existe
      if (questionId) {
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
          return res.status(400).json({
            ok: false,
            message: "ID de pregunta inválido"
          });
        }

        const question = await QuestionModel.findOne({
          _id: questionId,
          votationId
        }).lean();

        if (!question) {
          return res.status(404).json({
            ok: false,
            message: "Pregunta no encontrada en esta votación"
          });
        }
      }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // máximo 100
    const skip = (page - 1) * limit;

      // 4️⃣ Construir query de preguntas
      const questionQuery = { votationId, isActive: true };
      if (questionId) {
        questionQuery._id = questionId; // ← Filtrar por una sola pregunta
      }

      const questions = await QuestionModel.find(questionQuery).lean();

      // 5️⃣ Obtener estadísticas para cada pregunta
      const questionsWithStats = await Promise.all(
        questions.map(async (question) => {
          const stats = await this.getQuestionStats(question , skip , limit);
          return {
            id: question._id,
            label: question.label,
            type: question.type,
            stats
          };
        })
      );

      // 6️⃣ Total de participantes únicos (solo si es todas las preguntas)
      let totalParticipants = null;
      if (!questionId) {
        totalParticipants = await AnswerModel.distinct("userId", {
          votationId
        }).then(users => users.length);
      }

      // 7️⃣ Respuesta
      const responseData = {
        ok: true,
        data: {
          votationId,
          subject: votation.subject,
          description: votation.description,
          ...(totalParticipants !== null && { totalParticipants }),
          questions: questionsWithStats
        }
      };

      // Si es una sola pregunta, simplificamos la estructura
      if (questionId && questionsWithStats.length === 1) {
        responseData.data = {
          ...responseData.data,
          question: questionsWithStats[0]
        };
        delete responseData.data.questions;
      }

      return res.json(responseData);

    } catch (err) {
      console.error("Error en GetVotationResultsController:", err);
      return res.status(500).json({
        ok: false,
        message: "Error al obtener resultados"
      });
    }
  };

  async getQuestionStats(question, skip , limit) {
  const [answers, totalAnswers] = await Promise.all([
  dbBreaker.call(
    () =>
      AnswerModel.find({ questionId: question._id })
        .skip(skip)
        .limit(limit)
        .lean(),
    fallBacksBreaker.fallbackEmptyArray
  ),

  dbBreaker.call(
    () =>
      AnswerModel.countDocuments({ questionId: question._id }),
    () => 0
  )
]);   
   if (totalAnswers === 0) {
    return { 
      totalAnswers: 0,
      message: "No hay respuestas para esta pregunta"
    };
  }
  
  // Estadísticas base comunes
  const baseStats = {
    totalAnswers: answers.length,
    pageInfo: this.buildPageInfo(totalAnswers, limit, skip)

  };
 

  // Estadísticas según el tipo de pregunta
  switch (question.type) {
    case "MULTI_OPTION":
      return {
        ...baseStats,
        ...this.getMultiOptionStats(answers, question)
      };

    case "DATE":
      return {
        ...baseStats,
        ...this.getDateStats(answers)
      };

    case "HOUR":
      return {
        ...baseStats,
        ...this.getHourStats(answers)
      };

    case "SHORTANSWER":
    case "LARGEANSWER":
      return {
        ...baseStats,
        ...this.getTextStats(answers)
      };

    default:
      return baseStats;
  }
  }

buildPageInfo(total, limit, skip) {
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    limit,
    currentPage,
    totalPages,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
}

 // ===========================================
// ESTADÍSTICAS PARA MULTI_OPTION
// ===========================================
getMultiOptionStats(answers, question) {
  // Obtener configuración de opciones desde la pregunta
  const config = question.config || {};
  const options = config.options || [];
  
  // Inicializar contadores para cada opción
  const counts = {};
  options.forEach(opt => { 
    counts[opt.id] = 0; 
  });

  // Procesar cada respuesta
  answers.forEach(answer => {
    const answerValue = answer.value;
    
    // Verificar si la respuesta tiene la estructura esperada
    if (answerValue && answerValue.options && Array.isArray(answerValue.options)) {
      answerValue.options.forEach(opt => {
        // Si la opción está marcada y existe en counts, incrementar
        if (opt.isChecked && counts[opt.id] !== undefined) {
          counts[opt.id] += 1;
        }
      });
    }
  });

  const totalRespondents = answers.length;

  // Generar estadísticas por opción
  const optionsStats = options.map(opt => ({
    id: opt.id,
    label: opt.label,
    isChecked: opt.isChecked, // Valor por defecto de la configuración
    count: counts[opt.id] || 0,
    percentage: totalRespondents > 0 
      ? Number(((counts[opt.id] / totalRespondents) * 100).toFixed(1))
      : 0
  }));

  let additionalStats = {};

  // Estadísticas adicionales según allowMultiple
  if (config.allowMultiple) {
    // Calcular selecciones por usuario
    const selectionsPerUser = answers.map(a => {
      const answerValue = a.value;
      if (answerValue && answerValue.options) {
        return answerValue.options.filter(opt => opt.isChecked).length;
      }
      return 0;
    });

    // Promedio de selecciones
    const avgSelections = selectionsPerUser.length > 0
      ? Number((selectionsPerUser.reduce((a, b) => a + b, 0) / selectionsPerUser.length).toFixed(1))
      : 0;

    // Distribución de cuántas opciones selecciona cada usuario
    const selectionDistribution = {};
    selectionsPerUser.forEach(count => {
      selectionDistribution[count] = (selectionDistribution[count] || 0) + 1;
    });

    additionalStats = {
      allowMultiple: true,
      avgSelectionsPerUser: avgSelections,
      selectionDistribution: Object.entries(selectionDistribution).map(([selections, count]) => ({
        selections: parseInt(selections),
        count,
        percentage: Number(((count / totalRespondents) * 100).toFixed(1))
      }))
    };
  } else {  // ← CORREGIDO: eliminar la 's' suelta
    // Para opción única, encontrar la más seleccionada
    const maxCount = Math.max(...optionsStats.map(o => o.count));
    const topOptions = optionsStats.filter(o => o.count === maxCount);
    
    additionalStats = {
      allowMultiple: false,
      topOption: topOptions.length === 1 
        ? topOptions[0] 
        : { message: "Empate entre varias opciones", options: topOptions }
    };
  }

  return {
    totalRespondents,
    options: optionsStats,
    ...additionalStats
  };
}

 // ===========================================
// ESTADÍSTICAS PARA HOUR
// ===========================================
// ===========================================
// ESTADÍSTICAS PARA HOUR
// ===========================================
getHourStats(answers) {
  // Extraer horas de las respuestas
  const responses = answers.map(a => {
    if (a.value && typeof a.value === 'object') {
      if (a.value.hour !== undefined) {
        return {
          hour: a.value.hour,        // string "14"
          min: a.value.min || "00"    // string "30" o "00" por defecto
        };
      }
    }
    return null;
  }).filter(r => r !== null);

  // Si no hay horas válidas
  if (responses.length === 0) {
    return {
      totalRespondents: 0,
      message: "No hay horas válidas"
    };
  }

  // Convertir a números para cálculos
  const hourNumbers = responses.map(r => parseInt(r.hour));
  const minuteNumbers = responses.map(r => parseInt(r.min));

  // Estadísticas básicas
  const minHour = Math.min(...hourNumbers);
  const maxHour = Math.max(...hourNumbers);
  const avgHour = Math.round(hourNumbers.reduce((a, b) => a + b, 0) / hourNumbers.length);
  const avgMinute = Math.round(minuteNumbers.reduce((a, b) => a + b, 0) / minuteNumbers.length);

  // Función para formatear hora
  const formatTime = (hour, minute) => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  // Encontrar la hora más común (combinación hour+min)
  const timeCount = {};
  responses.forEach(r => {
    const key = formatTime(parseInt(r.hour), parseInt(r.min));
    timeCount[key] = (timeCount[key] || 0) + 1;
  });

  let mostCommon = null;
  let maxCount = 0;
  Object.entries(timeCount).forEach(([time, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = { time, count };
    }
  });

  // Distribución por hora (sin minutos)
  const hourDistribution = {};
  for (let i = 0; i < 24; i++) {
    hourDistribution[String(i).padStart(2, '0')] = 0;
  }
  responses.forEach(r => {
    hourDistribution[r.hour] = (hourDistribution[r.hour] || 0) + 1;
  });

  // Estadísticas por franjas de 3 horas
  const slots = {
    "00-03": 0, "03-06": 0, "06-09": 0, "09-12": 0,
    "12-15": 0, "15-18": 0, "18-21": 0, "21-24": 0
  };

  responses.forEach(r => {
    const hour = parseInt(r.hour);
    if (hour < 3) slots["00-03"]++;
    else if (hour < 6) slots["03-06"]++;
    else if (hour < 9) slots["06-09"]++;
    else if (hour < 12) slots["09-12"]++;
    else if (hour < 15) slots["12-15"]++;
    else if (hour < 18) slots["15-18"]++;
    else if (hour < 21) slots["18-21"]++;
    else slots["21-24"]++;
  });

  return {
    totalRespondents: responses.length,
    min: formatTime(minHour, minuteNumbers[hourNumbers.indexOf(minHour)] || 0),
    max: formatTime(maxHour, minuteNumbers[hourNumbers.indexOf(maxHour)] || 0),
    avg: formatTime(avgHour, avgMinute),
    mostCommon,
    distribution: Object.entries(slots).map(([range, count]) => ({
      range,
      count,
      percentage: Number(((count / responses.length) * 100).toFixed(1))
    })),
    byHour: Object.entries(hourDistribution).map(([hour, count]) => ({
      hour,
      count,
      percentage: Number(((count / responses.length) * 100).toFixed(1))
    }))
  };
}

 // ===========================================
// ESTADÍSTICAS PARA TEXTO (SHORT/LARGE ANSWER)
// ===========================================
 getTextStats(answers) {
  const texts = answers.map(a => {
    if (typeof a.value === "object" && a.value.value) {
      return a.value.value;  // { value: "texto" }
    }
    if (typeof a.value === 'string') {
      return a.value;  // "texto" directo
    }
    return null;
  }).filter(t => t !== null && t.trim().length > 0);

  // Si no hay respuestas
  if (texts.length === 0) {
    return {
      totalRespondents: 0,
      message: "No hay respuestas de texto"
    };
  }

  // Estadísticas de longitud
  const lengths = texts.map(t => t.length);
  const totalChars = lengths.reduce((a, b) => a + b, 0);

  const stats = {
    totalRespondents: texts.length,
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    avgLength: Number((totalChars / texts.length).toFixed(1))
  };

  // Conteo de palabras
  const wordCount = {};

  texts.forEach(text => {
    const words = text.toLowerCase()
      .replace(/[^\w\sáéíóúñ]/g, '')
      .split(/\s+/)
      .filter(word => word.length >= 4);

    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
  });

  // Top palabras
  stats.topWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Análisis de sentimiento
  const positiveWords = ['excelente', 'bueno', 'genial', 'perfecto', 'recomiendo', 'gracias', 'mejor', 'increíble'];
  const negativeWords = ['malo', 'pésimo', 'terrible', 'horrible', 'deficiente', 'queja', 'peor', 'lento'];

  let positiveCount = 0;
  let negativeCount = 0;

  texts.forEach(text => {
    const lowerText = text.toLowerCase();
    if (positiveWords.some(word => lowerText.includes(word))) positiveCount++;
    if (negativeWords.some(word => lowerText.includes(word))) negativeCount++;
  });

  stats.sentiment = {
    positive: positiveCount,
    negative: negativeCount,
    neutral: texts.length - (positiveCount + negativeCount),
    positivePercentage: Number(((positiveCount / texts.length) * 100).toFixed(1)),
    negativePercentage: Number(((negativeCount / texts.length) * 100).toFixed(1))
  };

  // Respuestas de ejemplo
  stats.sampleResponses = texts.slice(0, 3).map(text => ({
    preview: text.length > 50 ? text.substring(0, 50) + '...' : text,
    length: text.length
  }));

  return stats;
}

 // ===========================================
// ESTADÍSTICAS PARA DATE
// ===========================================
getDateStats(answers) {
  const dates = answers.map(a => {
    if (a.value && typeof a.value === "object") {
      if (a.value.date) {
        return new Date(a.value.date);  // { date: "2024-03-20T10:30:00Z" }
      }
      if (a.value.value) {
        return new Date(a.value.value); // { value: "2024-03-20" }
      }
    }
    if (typeof a.value === 'string') {
      return new Date(a.value);  // "2024-03-20" directo
    }
    return null;
  }).filter(d => d !== null && !isNaN(d.getTime()));

  // Si no hay fechas válidas
  if (dates.length === 0) {
    return {
      totalRespondents: 0,
      message: "No hay fechas válidas"
    };
  }

  const sortedDates = [...dates].sort((a, b) => a - b);
  const minDate = sortedDates[0];
  const maxDate = sortedDates[sortedDates.length - 1];

  // ✅ CORREGIDO: Paréntesis en el cálculo
  const rangeInDays = Math.round((maxDate - minDate) / (1000 * 60 * 60 * 24));

  // Estadísticas básicas
  const stats = {
    totalRespondents: dates.length,
    min: this.formatDate(minDate),
    max: this.formatDate(maxDate),
    rangeInDays,
    mostCommonDate: this.getMostCommonDate(dates),
    byYear: this.getDistributionByYear(dates),
    byMonth: this.getDistributionByMonth(dates)
  };

  // Si hay suficientes datos, agregar distribución por semana
  if (rangeInDays > 7 && rangeInDays <= 90) {
    stats.byWeek = this.getDistributionByWeek(dates, minDate, maxDate);
  }

  return stats;
}

// ===========================================
// MÉTODOS AUXILIARES PARA DATE
// ===========================================

// Formatear fecha como YYYY-MM-DD
formatDate(date) {
  return date.toISOString().split("T")[0];
}

getMostCommonDate(dates) {
  const countMap = {};
  dates.forEach(date => {
    // ✅ CORREGIDO: usar this.formatDate
    const dateStr = this.formatDate(date);
    countMap[dateStr] = (countMap[dateStr] || 0) + 1;
  });

  let mostCommon = null;
  let maxCount = 0;

  Object.entries(countMap).forEach(([dateStr, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = { date: dateStr, count };
    }
  });

  return mostCommon;
}

// Distribución por año
getDistributionByYear(dates) {
  const yearMap = {};

  dates.forEach(date => {
    const year = date.getFullYear();
    yearMap[year] = (yearMap[year] || 0) + 1;
  });

  return Object.entries(yearMap)
    .map(([year, count]) => ({
      year: parseInt(year),
      count,
      percentage: Number(((count / dates.length) * 100).toFixed(1))
    }))
    .sort((a, b) => a.year - b.year);
}

// Distribución por mes
getDistributionByMonth(dates) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const monthMap = {};

  dates.forEach(date => {
    const month = date.getMonth(); // 0-11
    monthMap[month] = (monthMap[month] || 0) + 1;
  });

  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    monthName: monthNames[i],
    count: monthMap[i] || 0,
    percentage: Number(((monthMap[i] || 0) / dates.length * 100).toFixed(1))
  }));
}

// Distribución por semana
getDistributionByWeek(dates, minDate, maxDate) {
  const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
  const weekMap = {};

  dates.forEach(date => {
    const weekIndex = Math.floor((date - minDate) / oneWeek);
    const weekStart = new Date(minDate.getTime() + (weekIndex * oneWeek));
    const weekEnd = new Date(weekStart.getTime() + oneWeek - 1);

    const weekLabel = `${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`;
    weekMap[weekLabel] = (weekMap[weekLabel] || 0) + 1;
  });

  return Object.entries(weekMap)
    .map(([week, count]) => ({
      week,
      count,
      percentage: Number(((count / dates.length) * 100).toFixed(1))
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}



}

