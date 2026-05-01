import { z } from 'zod';
import { QuestionInputSchema } from '../../question/form-validators/question.input.schema.js';
import { QuestionUpdateInputSchema } from '../../question/form-validators/question.update.schema.js';

export const VotationInputSchema = z.object({
  ownerId : z.string().min(1),
  subject : z.string().min(1),
  description : z.string().min(1),
  closes_at: z.iso.datetime(),
  questions: z.array(QuestionInputSchema).min(1)
})

export const VotationUpdateInputSchema = z.object({
  votationId: z.string().min(1, "VotationId es requerido"),
  ownerId: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().min(1),
  closes_at: z.iso.datetime(),
  questions: z.array(QuestionUpdateInputSchema).min(1)
});