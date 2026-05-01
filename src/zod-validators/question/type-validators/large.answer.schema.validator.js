import { z } from "zod"

export const LargeAnswerConfigSchema = z.object({
  value : z.string(),
  minLength: z.number().int().min(0).default(0),
  maxLength: z.number().int().positive().optional(),
  
}).strict().superRefine((data, ctx) => {
  if (data.minLength && data.value.length < data.minLength) {
    ctx.addIssue({
      minimum: data.minLength,
      type: "string",
      inclusive: true,
      message: `Mínimo ${data.minLength} caracteres`
    });
  }
  
  if (data.maxLength && data.value.length > data.maxLength) {
    ctx.addIssue({
      maximum: data.maxLength,
      type: "string",
      inclusive: true,
      message: `Máximo ${data.maxLength} caracteres`
    });
  }
})



