// zod-validators/answer/form-validators/answer.input.schema.js
import { z } from "zod";

export const AnswerInputSchema = z.object({
  userId: z.string().min(1, "UserId es requerido"),
  votationId: z.string().min(1, "VotationId es requerido"),
  questionId: z.string().min(1, "QuestionId es requerido"),
  questionVersion: z.number().int().positive("Version debe ser un número positivo"),
  value: z.any() // Será validado contra el tipo de pregunta
});

// Schema para múltiples respuestas
export const BulkAnswersInputSchema = z.object({
  answers: z.array(AnswerInputSchema).min(1, "Debe enviar al menos una respuesta")
});