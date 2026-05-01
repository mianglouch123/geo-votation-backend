import { NotificationActions } from "../../../zod-validators/notification/actions/notifications.actions.js";

export const buildGroupKey = (action, payload) => {
  switch (action) {
    case NotificationActions.VOTATION_CREATED:
      return `VOTATION_CREATED:${payload.votationId}`;

    case NotificationActions.SEND_INVITATION_VOTATION:
      return `SEND_INVITATION_VOTATION:${payload.votationId}`;

    case NotificationActions.RECEIVED_INVITATION_VOTATION:
      return `RECEIVED_INVITATION_VOTATION:${payload.votationId}`;

    // 🔥 NUEVO: Para transferencias
    case NotificationActions.TRANSFER_PROPERTY:
      return `TRANSFER_PROP:${payload.votationId}:${payload.newOwnerId}`;

    case NotificationActions.RECEIVED_PROPERTY:
      return `RECEIVED_PROP:${payload.votationId}:${payload.previousOwnerId}`;

     // ✅ NUEVO: Para invitaciones revocadas
    case NotificationActions.INVITATION_REVOKED:
      return `INVITATION_REVOKED:${payload.votationId}:${payload.invitedEmail}`;

    case NotificationActions.VOTATION_CLOSED:
    return `VOTATION_CLOSED:${payload.votationId}`;


    default:
      throw new Error("Unsupported action");
  }
};