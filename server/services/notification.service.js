import { NotificationModel } from "../models/notification.model.js";
import { EmployeeModel } from "../models/employee.model.js";
import { getIO } from "../socket.js";

export const sendNotification = async ({
  company,
  roles,
  recipientUserId,
  title,
  message,
  type,
  bookingId,
  excludeUserId,
  lockedId
}) => {
  const recipientSet = new Set();

  // ✅ CASE 1: Direct user
  if (recipientUserId) {
    recipientSet.add(recipientUserId.toString());
  }

  // ✅ CASE 2: Role-based users
  if (roles?.length) {
    const users = await EmployeeModel.find({
      company,
      type: { $in: roles },
    }).select("_id");

    users.forEach(u => {
      if (u._id.toString() !== excludeUserId?.toString()) {
        recipientSet.add(u._id.toString());
      }
    });
  }

  const recipients = [...recipientSet];

  if (!recipients.length) return;

  const notification = await NotificationModel.create({
    company,
    title,
    message,
    type,
    bookingId: bookingId || undefined,
    recipients,
    createdBy: excludeUserId,
    lockedId: lockedId || null
  });

  const io = getIO();
  recipients.forEach(userId => {
    io.to(userId).emit("notification:new", notification);
  });
};
