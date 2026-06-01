"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleMiddleware = void 0;
const response_1 = require("../utils/response");
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !allowedRoles.includes(role)) {
            return (0, response_1.sendError)(res, 403, 'You do not have permission to access this resource');
        }
        next();
    };
};
exports.roleMiddleware = roleMiddleware;
