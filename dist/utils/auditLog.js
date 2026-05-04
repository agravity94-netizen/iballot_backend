"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const auditLog = async ({ action, entity, entityId, ipAddress, actorId }) => {
    try {
        await prisma.auditLog.create({
            data: {
                action,
                entity,
                entityId,
                ipAddress,
                actorId,
            },
        });
    }
    catch (err) {
        console.error('Audit Log Error:', err);
    }
};
exports.auditLog = auditLog;
