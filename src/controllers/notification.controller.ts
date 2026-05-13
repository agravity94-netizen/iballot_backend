import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendError, sendSuccess } from '../utils/response';

export const notificationController = {
  getAll: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(res, 200, 'Notifications fetched', {
        notifications: notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          targetType: null,
          targetId: null,
        })),
        unreadCount: notifications.filter((notification) => !notification.isRead).length,
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  markRead: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const notification = await prisma.notification.updateMany({
        where: { id: String(req.params.id), userId },
        data: { isRead: true },
      });

      if (!notification.count) {
        return sendError(res, 404, 'Notification not found');
      }

      return sendSuccess(res, 200, 'Notification marked as read', { id: req.params.id });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  markAllRead: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return sendSuccess(res, 200, 'Notifications marked as read', { updatedCount: result.count });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },
};
