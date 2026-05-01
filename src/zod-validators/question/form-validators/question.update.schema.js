// zod-validators/question/form-validators/question.update.schema.js
import { z } from "zod";

export const QuestionUpdateInputSchema = z.object({
  questionId: z.string().nullable().optional(),  // ✅ Permite null, undefined o string
  label: z.string().min(1),
  code: z.string().min(1),
  type: z.enum([
    "DATE",
    "HOUR", 
    "SHORTANSWER",
    "LARGEANSWER",
    "MULTI_OPTION"
  ]),
  isRequired: z.boolean().default(false),
  config: z.any() // Se validará con QuestionTypeConfigSchemas
});