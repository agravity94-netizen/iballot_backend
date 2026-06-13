"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.constituencyController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
exports.constituencyController = {
    // GET /api/constituencies
    // Optional query params: city, province, type
    getAll: async (req, res) => {
        try {
            const { city, province, type } = req.query;
            const where = {};
            if (type) {
                const typeStr = type.toUpperCase().replace(/\s+/g, '_');
                if (typeStr.startsWith('NATIONAL')) {
                    where.type = { in: ['NATIONAL', 'NATIONAL_ASSEMBLY'] };
                }
                else if (typeStr.startsWith('PROVINCIAL')) {
                    where.type = { in: ['PROVINCIAL', 'PROVINCIAL_ASSEMBLY'] };
                }
                else {
                    where.type = typeStr;
                }
            }
            if (city) {
                where.city = { name: city };
            }
            else if (province) {
                where.city = { province: { name: province } };
            }
            const constituencies = await database_1.default.constituency.findMany({
                where,
                include: {
                    city: {
                        include: { province: true }
                    }
                },
                orderBy: { name: 'asc' }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Constituencies retrieved', constituencies);
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/constituencies/locations
    getLocations: async (req, res) => {
        try {
            const { province } = req.query;
            if (province) {
                // Get cities for a specific province
                const cities = await database_1.default.city.findMany({
                    where: { province: { name: province } },
                    orderBy: { name: 'asc' },
                    select: { name: true }
                });
                return (0, response_1.sendSuccess)(res, 200, `Cities for ${province} retrieved`, {
                    cities: cities.map(c => c.name)
                });
            }
            // Default: Get all provinces and all cities (for initial state)
            const [provinces, cities] = await Promise.all([
                database_1.default.province.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
                database_1.default.city.findMany({ orderBy: { name: 'asc' }, select: { name: true } })
            ]);
            return (0, response_1.sendSuccess)(res, 200, 'Locations retrieved', {
                provinces: provinces.map(p => p.name),
                cities: cities.map(c => c.name)
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    }
};
