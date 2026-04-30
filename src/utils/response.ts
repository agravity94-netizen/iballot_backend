import { Response } from 'express';

export const sendSuccess = (res: Response, status: number, message: string, data: any = null) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res: Response, status: number, message: string) => {
  return res.status(status).json({
    success: false,
    message,
  });
};
