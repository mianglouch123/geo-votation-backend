import { z } from "zod"
import { CreateVotationPayload } from "./payloads/create.votation.payload.js"
import { NotificationActions } from "./actions/notifications.actions.js"

export const NotificationPayloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal(NotificationActions.VOTATION_CREATED),
    payload: CreateVotationPayload.optional(),
  }),
]);