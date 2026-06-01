"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const database_1 = __importDefault(require("../config/database"));
const auditLog = async ({ action, entity, entityId, ipAddress, actorId, metadata }) => {
    try {
        await database_1.default.auditLog.create({
            data: {
                action,
                entity,
                entityId,
                ipAddress,
                actorId,
                metadata,
            },
        });
    }
    catch (err) {
        console.error('Audit Log Error:', err);
    }
};
exports.auditLog = auditLog;
