import { NotificationModel } from "../models/notification.model.js";

export const getMyNotifications = async (req, res) => {
  const notifications = await NotificationModel.find({
    recipients: req.user.id,
  }).populate("company")
    .sort({ createdAt: -1 })
    .limit(50);

  // console.log("Noti : ", notifications)
  res.json({ success: true, notifications });
};

export const markAsRead = async (req, res) => {
  const { id } = req.params;

  await NotificationModel.findByIdAndUpdate(id, {
    $addToSet: { readBy: req.user.id },
  });

  res.json({ success: true });
};

export const unreadCount = async (req, res) => {
  const count = await NotificationModel.countDocuments({
    recipients: req.user.id,
    readBy: { $ne: req.user.id },
  });

  res.json({ success: true, count });
};
