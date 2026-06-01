"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
exports.notificationController = {
    getAll: async (req, res) => {
        try {
            const userId = req.user.userId;
            const notifications = await database_1.default.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            });
            return (0, response_1.sendSuccess)(res, 200, 'Notifications fetched', {
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
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    markRead: async (req, res) => {
        try {
            const userId = req.user.userId;
            const notification = await database_1.default.notification.updateMany({
                where: { id: String(req.params.id), userId },
                data: { isRead: true },
            });
            if (!notification.count) {
                return (0, response_1.sendError)(res, 404, 'Notification not found');
            }
            return (0, response_1.sendSuccess)(res, 200, 'Notification marked as read', { id: req.params.id });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    markAllRead: async (req, res) => {
        try {
            const userId = req.user.userId;
            const result = await database_1.default.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true },
            });
            return (0, response_1.sendSuccess)(res, 200, 'Notifications marked as read', { updatedCount: result.count });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
};
