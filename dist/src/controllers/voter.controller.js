"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voterController = void 0;
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
exports.voterController = {
    getHistory: async (req, res) => {
        try {
            const userId = req.user.userId;
            const history = await database_1.default.voteReceipt.findMany({
                where: { userId },
                include: {
                    election: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                        },
                    },
                },
                orderBy: { castedAt: 'desc' },
            });
            return (0, response_1.sendSuccess)(res, 200, 'Voting history fetched', {
                history: history.map((item) => ({
                    electionId: item.election.id,
                    electionTitle: item.election.title,
                    electionStatus: item.election.status,
                    castedAt: item.castedAt,
                    receiptHash: item.receiptHash,
                    resultsPublished: item.election.status === 'RESULTS_PUBLISHED',
                    canViewResults: item.election.status === 'RESULTS_PUBLISHED',
                })),
            });
        }
        catch (err) {
            return (0, response_1.sendError)(res, 500, err.message);
        }
    },
};
