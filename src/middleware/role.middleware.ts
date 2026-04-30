import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return sendError(res, 403, 'You do not have permission to access this resource');
    }
    next();
  };
};
