"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const error_middleware_1 = require("./middleware/error.middleware");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const election_routes_1 = __importDefault(require("./routes/election.routes"));
const vote_routes_1 = __importDefault(require("./routes/vote.routes"));
const candidate_routes_1 = __importDefault(require("./routes/candidate.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const result_routes_1 = __importDefault(require("./routes/result.routes"));
const constituency_routes_1 = __importDefault(require("./routes/constituency.routes"));
const appeal_routes_1 = __importDefault(require("./routes/appeal.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const voter_routes_1 = __importDefault(require("./routes/voter.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const app = (0, express_1.default)();
// ─── Security Headers ───────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use(helmet_1.default.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet_1.default.noSniff());
app.use(helmet_1.default.frameguard({ action: 'deny' }));
// ─── CORS ───────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: '*', // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// ─── Body Parser ────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'iBallot API'
    });
});
// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', auth_routes_1.default);
app.use('/api/elections', election_routes_1.default);
app.use('/api/votes', vote_routes_1.default);
app.use('/api/candidates', candidate_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/results', result_routes_1.default);
app.use('/api/constituencies', constituency_routes_1.default);
app.use('/api/appeals', appeal_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/voter', voter_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
// ─── Frontend Logging ───────────────────────────────────────────
app.post('/api/logs', (req, res) => {
    const { message, error, stack, screen, payload } = req.body;
    const logEntry = `\n[${new Date().toISOString()}] [Screen: ${screen || 'Unknown'}]\nMessage: ${message}\nPayload: ${JSON.stringify(payload || {})}\nError: ${JSON.stringify(error || {})}\nStack: ${stack || 'No stack trace'}\n----------------------------------------`;
    fs_1.default.appendFile(path_1.default.join(__dirname, '../frontend-error.log'), logEntry, (err) => {
        if (err)
            console.error('Failed to write to log file:', err);
    });
    res.status(200).json({ success: true });
});
// ─── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});
// ─── Global Error Handler ───────────────────────────────────────
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
