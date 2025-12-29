import { NotificationModel } from "../models/notification.model.js";
import { EmployeeModel } from "../models/employee.model.js";
import { getIO } from "../socket.js";

export const sendNotification = async ({
  company,
  roles,
  title,
  message,
  type,
  bookingId,
  excludeUserId,
}) => {
  const users = await EmployeeModel.find({
    company,
    type: { $in: roles },
  }).select("_id");

  const recipients = users
    .map(u => u._id)
    .filter(id => id.toString() !== excludeUserId?.toString());

  if (!recipients.length) return;

  const notification = await NotificationModel.create({
    company,
    title,
    message,
    type,
    bookingId,
    recipients,
  });

  const io = getIO();

  recipients.forEach(userId => {
    io.to(userId.toString()).emit("notification:new", notification);
  });
};
