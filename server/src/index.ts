import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { getDb, initSchema } from './db/database';
import { seedDatabase } from './db/seed';
import attackRouter from './routes/attack';
import d3fendRouter from './routes/d3fend';
import detectionsRouter from './routes/detections';
import toolsRouter from './routes/tools';
import coverageRouter from './routes/coverage';
import tagsRouter from './routes/tags';
import assignmentsRouter from './routes/assignments';
import auditRouter from './routes/audit';
import commentsRouter from './routes/comments';
import snapshotsRouter from './routes/snapshots';
import threatGroupsRouter from './routes/threat-groups';
import complianceRouter from './routes/compliance';
import sigmaRouter from './routes/sigma';
import exportsRouter from './routes/exports';
import reportsRouter from './routes/reports';
import riskRouter from './routes/risk';
import apiKeysRouter from './routes/api-keys';
import adminRouter from './routes/admin';
import { requireApiKey } from './middleware/auth';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use('/api', requireApiKey);

const db = getDb();
initSchema(db);
seedDatabase(db);

app.use('/api/attack', attackRouter);
app.use('/api/d3fend', d3fendRouter);
app.use('/api/detections', detectionsRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/coverage', coverageRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/snapshots', snapshotsRouter);
app.use('/api/threat-groups', threatGroupsRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/sigma', sigmaRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/risk', riskRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve built React app in production
const clientDist = path.join(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`MitreMap server running on http://localhost:${PORT}`);
});
