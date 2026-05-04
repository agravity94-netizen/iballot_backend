"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constituencyController = void 0;
const client_1 = require("@prisma/client");
const response_1 = require("../utils/response");
const prisma = new client_1.PrismaClient();
exports.constituencyController = {
    // GET /api/constituencies
    getAll: async (req, res) => {
        try {
            const constituencies = await prisma.constituency.findMany({
                orderBy: { name: 'asc' }
            });
            return (0, response_1.sendSuccess)(res, 200, 'Constituencies retrieved', constituencies);
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
    // GET /api/locations/provinces
    // Helper for the dropdowns
    getLocations: async (req, res) => {
        try {
            // Mock data for provinces/cities as they might not be in the DB yet
            // or we can extract them from constituency types
            const provinces = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory'];
            const cities = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta', 'Multan', 'Faisalabad'];
            return (0, response_1.sendSuccess)(res, 200, 'Locations retrieved', { provinces, cities });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    }
};
