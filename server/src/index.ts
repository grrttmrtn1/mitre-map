import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { openapiSpec } from './openapi';
import { runMigrations, getKnex, rawGet } from './db/database';
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
import motivationsRouter from './routes/motivations';
import countriesRouter from './routes/countries';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import dataSourcesRouter from './routes/data-sources';
import atomicRouter from './routes/atomic';
import exercisesRouter from './routes/exercises';
import taxiiRouter from './routes/taxii';
import { initScheduler } from './taxii/scheduler';
import { requireApiKey } from './middleware/auth';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173', credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});
app.use('/api/auth/login', loginRateLimit);

app.use('/api', requireApiKey);

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
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
app.use('/api/motivations', motivationsRouter);
app.use('/api/countries', countriesRouter);
app.use('/api/data-sources', dataSourcesRouter);
app.use('/api/atomic', atomicRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/taxii', taxiiRouter);

// OpenAPI spec — machine-readable, no auth required
app.get('/api/openapi.json', (_req, res) => {
  res.json(openapiSpec);
});

// Swagger UI — relax CSP only for this route
app.use(
  '/api/docs',
  ((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
    );
    next();
  }) as express.RequestHandler,
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, { customSiteTitle: 'MitreMap API Docs' }),
);

app.get('/api/health', async (_req, res) => {
  try {
    const db = getKnex();
    const [keyCount, userCount] = await Promise.all([
      rawGet<{ n: number }>(db, 'SELECT COUNT(*) as n FROM api_keys', []),
      rawGet<{ n: number }>(db, 'SELECT COUNT(*) as n FROM users', []),
    ]);
    const totalAuthEntities = ((keyCount as any)?.n ?? 0) + ((userCount as any)?.n ?? 0);
    res.json({ status: 'ok', timestamp: new Date().toISOString(), bootstrap: totalAuthEntities === 0 });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

const clientDist = path.join(__dirname, '../../client/dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

async function loadTlsOptions(): Promise<https.ServerOptions> {
  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;

  if (certPath && keyPath) {
    console.log('Loading SSL certificates from provided paths...');
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  console.log('No SSL_CERT_PATH/SSL_KEY_PATH set — generating self-signed certificate...');
  const { generate } = await import('selfsigned');
  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 1);
  const pems = await generate([{ name: 'commonName', value: 'localhost' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate,
  });
  return { cert: pems.cert, key: pems.private };
}

async function start() {
  await runMigrations();
  const db = getKnex();
  await seedDatabase(db);
  await initScheduler();

  if (process.env.NODE_ENV === 'production') {
    const tlsOptions = await loadTlsOptions();
    https.createServer(tlsOptions, app).listen(PORT, '0.0.0.0', () => {
      console.log(`MitreMap server running on https://0.0.0.0:${PORT}`);
    });
  } else {
    http.createServer(app).listen(PORT, '0.0.0.0', () => {
      console.log(`MitreMap server running on http://0.0.0.0:${PORT}`);
    });
  }
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
