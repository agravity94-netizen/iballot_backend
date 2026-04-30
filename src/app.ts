import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { errorMiddleware } from './middleware/error.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import electionRoutes from './routes/election.routes';
import voteRoutes from './routes/vote.routes';
import candidateRoutes from './routes/candidate.routes';
import adminRoutes from './routes/admin.routes';
import resultRoutes from './routes/result.routes';
import constituencyRoutes from './routes/constituency.routes';

const app = express();

// ─── Security Headers ───────────────────────────────────────────
app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));

// ─── CORS ───────────────────────────────────────────────────────
app.use(cors({
  origin: '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── Body Parser ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'iBallot API'
  });
});

// ─── API Routes ─────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/elections',  electionRoutes);
app.use('/api/votes',      voteRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/results',    resultRoutes);
app.use('/api/constituencies', constituencyRoutes);

// ─── Frontend Logging ───────────────────────────────────────────
app.post('/api/logs', (req, res) => {
  const { message, error, stack, screen, payload } = req.body;
  const logEntry = `\n[${new Date().toISOString()}] [Screen: ${screen || 'Unknown'}]\nMessage: ${message}\nPayload: ${JSON.stringify(payload || {})}\nError: ${JSON.stringify(error || {})}\nStack: ${stack || 'No stack trace'}\n----------------------------------------`;
  
  fs.appendFile(path.join(__dirname, '../frontend-error.log'), logEntry, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });
  
  res.status(200).json({ success: true });
});

// ─── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ───────────────────────────────────────
app.use(errorMiddleware);

export default app;
