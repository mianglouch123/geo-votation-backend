import { z } from "zod"

export const QuestionInputSchema = z.object({
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
  config: z.any()

})