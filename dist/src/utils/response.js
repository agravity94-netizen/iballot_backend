"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, status, message, data = null) => {
    return res.status(status).json({
        success: true,
        message,
        data,
    });
};
exports.sendSuccess = sendSuccess;
const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message,
    });
};
exports.sendError = sendError;
