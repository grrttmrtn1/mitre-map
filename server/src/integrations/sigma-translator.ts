import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export type SiemBackend = 'splunk' | 'elasticsearch' | 'microsoft365defender' | 'crowdstrike' | 'qradar' | 'chronicle';

const BACKEND_PIPELINE: Record<SiemBackend, string[]> = {
  splunk: ['splunk'],
  elasticsearch: ['ecs_windows'],
  microsoft365defender: ['microsoft365defender'],
  crowdstrike: ['crowdstrike'],
  qradar: ['qradar'],
  chronicle: ['chronicle_contextual'],
};

export async function translateSigma(sigmaYaml: string, backend: SiemBackend): Promise<string> {
  const tmpFile = join(tmpdir(), `mitremap-sigma-${randomBytes(6).toString('hex')}.yml`);
  await writeFile(tmpFile, sigmaYaml, 'utf8');

  try {
    const pipeline = BACKEND_PIPELINE[backend];
    const args = ['convert', '-t', backend, ...pipeline.flatMap(p => ['-p', p]), tmpFile];

    return await new Promise<string>((resolve, reject) => {
      const proc = spawn('sigma', args, { env: process.env });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(`sigma-cli exited with code ${code}: ${stderr.trim()}`));
        else resolve(stdout.trim());
      });
      proc.on('error', (err) => {
        if ((err as any).code === 'ENOENT') reject(new Error('sigma-cli not found. Install with: pip install sigma-cli'));
        else reject(err);
      });
    });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

export async function isSigmaAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn('sigma', ['--version'], { env: process.env });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}
