import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess, sendError } from '../utils/response';

const prisma = new PrismaClient();

export const constituencyController = {
  // GET /api/constituencies
  getAll: async (req: Request, res: Response) => {
    try {
      const constituencies = await prisma.constituency.findMany({
        orderBy: { name: 'asc' }
      });
      return sendSuccess(res, 200, 'Constituencies retrieved', constituencies);
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/locations/provinces
  // Helper for the dropdowns
  getLocations: async (req: Request, res: Response) => {
    try {
      // Mock data for provinces/cities as they might not be in the DB yet
      // or we can extract them from constituency types
      const provinces = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory'];
      const cities = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta', 'Multan', 'Faisalabad'];

      return sendSuccess(res, 200, 'Locations retrieved', { provinces, cities });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
