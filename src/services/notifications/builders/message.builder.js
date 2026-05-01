import { NotificationActions } from "../../../zod-validators/notification/actions/notifications.actions.js";

export const buildMessage = ({ action, count, payload }) => {
  switch(action) {
    case NotificationActions.VOTATION_CREATED:
      if(count === 1) {
        return `Has creado la votación "${payload?.votationTitle || 'nueva'}"`;
      }
      return `Has creado ${count} nuevas votaciones`;

    case NotificationActions.RECEIVED_INVITATION_VOTATION:
      if(count === 1) {
        return `Has sido invitado a la votación "${payload?.votationTitle || 'participar'}" con rol ${payload?.role || ''}`;
      }
      return `Has recibido ${count} nuevas invitaciones a la votación "${payload?.votationTitle || ''}"`;

    case NotificationActions.SEND_INVITATION_VOTATION:
      if(count === 1) {
        return `Invitaste a ${payload?.invitedEmail || 'un usuario'} a la votación "${payload?.votationTitle || ''}"`;
      }
      return `Has enviado ${count} nuevas invitaciones a la votación "${payload?.votationTitle || ''}"`;

    case NotificationActions.TRANSFER_PROPERTY:
      if(count === 1) {
        return `Has transferido la propiedad de la votación "${payload?.votationTitle || ''}" a ${payload?.newOwnerEmail || 'nuevo propietario'}`;
      }
      return `Has transferido ${count} votaciones a nuevos propietarios`;

    case NotificationActions.RECEIVED_PROPERTY:
      if(count === 1) {
        return `${payload?.previousOwnerEmail || 'Alguien'} te ha transferido la propiedad de la votación "${payload?.votationTitle || ''}"`;
      }
      return `Has recibido ${count} nuevas votaciones por transferencia de propiedad`;

    case NotificationActions.INVITATION_REVOKED:
      if(count === 1) {
        return `Tu invitación a la votación "${payload?.votationTitle || ''}" ha sido revocada por el administrador`;
      }
      return `Tus invitaciones a ${payload?.votationTitle || ""} votaciones han sido revocadas ${count} veces`;

   case NotificationActions.VOTATION_CLOSED:
     if(count === 1) {
    return `La votación "${payload?.votationTitle}" ha sido cerrada`;
    }
  return `${count} votaciones han sido cerradas`;


    default:
      return "Tienes una nueva notificación.";
  }
};