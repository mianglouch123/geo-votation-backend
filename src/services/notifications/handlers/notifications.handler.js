import { NotificationActions } from "../../../zod-validators/notification/actions/notifications.actions.js";
import { CreateNotificationService } from "../services/create.notification.service.js";

export const notificationHandlers = {
[NotificationActions.VOTATION_CREATED]: new CreateNotificationService(),
[NotificationActions.RECEIVED_INVITATION_VOTATION] : new CreateNotificationService(),
[NotificationActions.SEND_INVITATION_VOTATION] : new CreateNotificationService(),
[NotificationActions.TRANSFER_PROPERTY]: new CreateNotificationService(),
[NotificationActions.RECEIVED_PROPERTY] : new CreateNotificationService(),
[NotificationActions.INVITATION_REVOKED] : new CreateNotificationService(),
[NotificationActions.VOTATION_CLOSED] : new CreateNotificationService(),

}



