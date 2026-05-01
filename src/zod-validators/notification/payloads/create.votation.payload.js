import { z } from "zod"

export const CreateVotationPayload = z.object({
  votationId: z.string(),
  votationTitle: z.string(),
  createdBy: z.string(), // userId

})
