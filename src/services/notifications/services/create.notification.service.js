import { buildMessage } from "../builders/message.builder.js";
import { buildGroupKey } from "../builders/group.key.builder.js";
import { NotificationModel } from "../../../models/notification.model.js";

export class CreateNotificationService {

 execute = async({userId, action, payload}) => {

  const groupKey = buildGroupKey(action, payload);
  const existingNotification = await NotificationModel.findOne({ userId, groupKey, read: false });

  if(existingNotification) {
   existingNotification.count += 1;
   existingNotification.last_message = buildMessage({action, count: existingNotification.count, payload});

   await existingNotification.save();
   return existingNotification;
  }

  const newNotification = new NotificationModel({
    userId,
    groupKey,
    action,
    payload,
    count: 1,
    last_message: buildMessage({action, count: 1 , payload}),
    read: false
  });

  await newNotification.save();
  return newNotification;
 }

}