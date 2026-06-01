"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const PORT = process.env.PORT || 5000;
const bootstrap = async () => {
    try {
        // Test DB connection
        await database_1.default.$connect();
        console.log('✅ Database connected');
        app_1.default.listen(PORT, () => {
            console.log(`🚀 iBallot API running on port ${PORT}`);
            console.log(`📋 Health check: http://localhost:${PORT}/health`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (err) {
        console.error('❌ Failed to start server:', err);
        await database_1.default.$disconnect();
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await database_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await database_1.default.$disconnect();
    process.exit(0);
});
bootstrap();
