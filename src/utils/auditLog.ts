import prisma from '../config/database';


interface AuditLogParams {
  action: string;
  entity: string;
  entityId?: string;
  ipAddress?: string;
  actorId?: string;
  metadata?: any;
}

export const auditLog = async ({ action, entity, entityId, ipAddress, actorId, metadata }: AuditLogParams) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        ipAddress,
        actorId,
        metadata,
      },
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};
