import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditLogParams {
  action: string;
  entity: string;
  entityId?: string;
  ipAddress?: string;
  actorId?: string;
}

export const auditLog = async ({ action, entity, entityId, ipAddress, actorId }: AuditLogParams) => {
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
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};
