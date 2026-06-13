import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';



export const constituencyController = {
  // GET /api/constituencies
  // Optional query params: city, province, type
  getAll: async (req: Request, res: Response) => {
    try {
      const { city, province, type } = req.query;
      
      const where: any = {};
      if (type) {
        const typeStr = (type as string).toUpperCase().replace(/\s+/g, '_');
        if (typeStr.startsWith('NATIONAL')) {
          where.type = { in: ['NATIONAL', 'NATIONAL_ASSEMBLY'] };
        } else if (typeStr.startsWith('PROVINCIAL')) {
          where.type = { in: ['PROVINCIAL', 'PROVINCIAL_ASSEMBLY'] };
        } else {
          where.type = typeStr;
        }
      }
      
      if (city) {
        where.city = { name: city as string };
      } else if (province) {
        where.city = { province: { name: province as string } };
      }

      const constituencies = await prisma.constituency.findMany({
        where,
        include: {
          city: {
            include: { province: true }
          }
        },
        orderBy: { name: 'asc' }
      });
      
      return sendSuccess(res, 200, 'Constituencies retrieved', constituencies);
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  },

  // GET /api/constituencies/locations
  getLocations: async (req: Request, res: Response) => {
    try {
      const { province } = req.query;

      if (province) {
        // Get cities for a specific province
        const cities = await prisma.city.findMany({
          where: { province: { name: province as string } },
          orderBy: { name: 'asc' },
          select: { name: true }
        });
        return sendSuccess(res, 200, `Cities for ${province} retrieved`, { 
          cities: cities.map(c => c.name) 
        });
      }

      // Default: Get all provinces and all cities (for initial state)
      const [provinces, cities] = await Promise.all([
        prisma.province.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
        prisma.city.findMany({ orderBy: { name: 'asc' }, select: { name: true } })
      ]);

      return sendSuccess(res, 200, 'Locations retrieved', { 
        provinces: provinces.map(p => p.name), 
        cities: cities.map(c => c.name) 
      });
    } catch (err: any) {
      return sendError(res, 500, err.message);
    }
  }
};
