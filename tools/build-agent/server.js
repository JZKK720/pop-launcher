const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const repoRoot = path.resolve(__dirname, '..', '..');
const packageJson = require(path.join(repoRoot, 'package.json'));
const host = process.env.BUILD_SERVICE_HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || process.env.BUILD_SERVICE_PORT || '3001', 10);
const buildCommand = process.env.BUILD_COMMAND || 'npm run build:win';
const installCommand = process.env.BUILD_INSTALL_COMMAND || '';
const buildToken = process.env.BUILD_TOKEN || '';
const distDir = path.resolve(repoRoot, process.env.BUILD_DIST_DIR || 'dist');
const artifactRoot = path.resolve(repoRoot, process.env.BUILD_OUTPUT_DIR || 'artifacts');
const stateRoot = path.resolve(repoRoot, process.env.BUILD_STATE_DIR || 'build-service-data');
const jobsDir = path.join(stateRoot, 'jobs');
const logsDir = path.join(stateRoot, 'logs');

const jobs = new Map();
let activeJobId = null;
let latestSuccessfulJobId = null;

function buildBaseUrl(req, url) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || url.protocol.replace(':', '') || 'http';
  const requestHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host || `localhost:${port}`;
  return `${proto}://${requestHost}`;
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function text(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function notFound(res) {
  json(res, 404, { error: 'Not found' });
}

function readAuthToken(req, url) {
  const headerToken = req.headers['x-build-token'];
  if (Array.isArray(headerToken)) {
    return headerToken[0] || '';
  }
  return headerToken || url.searchParams.get('token') || '';
}

function isAuthorized(req, url) {
  if (!buildToken) {
    return true;
  }
  return readAuthToken(req, url) === buildToken;
}

function ensureAuthorized(req, res, url) {
  if (isAuthorized(req, url)) {
    return true;
  }
  json(res, 401, { error: 'Unauthorized' });
  return false;
}

async function ensureDirectories() {
  await Promise.all([
    fsp.mkdir(artifactRoot, { recursive: true }),
    fsp.mkdir(jobsDir, { recursive: true }),
    fsp.mkdir(logsDir, { recursive: true })
  ]);
}

async function loadJobs() {
  const fileNames = await fsp.readdir(jobsDir);
  for (const fileName of fileNames.filter((name) => name.endsWith('.json'))) {
    const filePath = path.join(jobsDir, fileName);
    try {
      const raw = await fsp.readFile(filePath, 'utf8');
      const job = JSON.parse(raw);
      jobs.set(job.id, job);
      if (job.status === 'running') {
        job.status = 'failed';
        job.finishedAt = job.finishedAt || new Date().toISOString();
        job.exitCode = job.exitCode ?? -1;
        job.error = job.error || 'Service restarted while build was running';
        await persistJob(job);
      }
      if (job.status === 'succeeded') {
        if (!latestSuccessfulJobId) {
          latestSuccessfulJobId = job.id;
        } else {
          const currentLatest = jobs.get(latestSuccessfulJobId);
          if (new Date(job.finishedAt || job.createdAt).getTime() > new Date(currentLatest.finishedAt || currentLatest.createdAt).getTime()) {
            latestSuccessfulJobId = job.id;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to load job metadata from ${filePath}:`, error);
    }
  }
}

async function persistJob(job) {
  const jobPath = path.join(jobsDir, `${job.id}.json`);
  await fsp.writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
}

function createJobResponse(job, baseUrl) {
  const response = {
    id: job.id,
    status: job.status,
    version: job.version,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    exitCode: job.exitCode ?? null,
    error: job.error || null,
    installRequested: Boolean(job.installRequested),
    cleanDist: Boolean(job.cleanDist),
    command: job.command,
    artifact: job.artifact
      ? {
          fileName: job.artifact.fileName,
          sha256: job.artifact.sha256,
          size: job.artifact.size,
          localPath: job.artifact.localPath,
          downloadUrl: `${baseUrl}/builds/${job.id}/artifact`
        }
      : null,
    logUrl: `${baseUrl}/builds/${job.id}/logs`
  };

  if (latestSuccessfulJobId === job.id && job.status === 'succeeded') {
    response.latestArtifactUrl = `${baseUrl}/artifacts/latest`;
  }

  return response;
}

function selectJobs(limit) {
  return Array.from(jobs.values())
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

function getJob(id) {
  return jobs.get(id) || null;
}

async function parseJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function generateJobId() {
  return crypto.randomUUID();
}

async function removeDistIfRequested(job) {
  if (!job.cleanDist) {
    return;
  }
  await fsp.rm(distDir, { recursive: true, force: true });
}

function getShellInvocation(command) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', command]
    };
  }
  return {
    command: '/bin/sh',
    args: ['-lc', command]
  };
}

function appendLog(stream, line) {
  stream.write(`[${new Date().toISOString()}] ${line}`);
}

async function sha256ForFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

async function findInstaller() {
  const entries = await fsp.readdir(distDir, { withFileTypes: true });
  const installers = [];

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.exe') {
      continue;
    }
    const filePath = path.join(distDir, entry.name);
    const stats = await fsp.stat(filePath);
    installers.push({ filePath, stats });
  }

  if (installers.length === 0) {
    throw new Error(`No Windows installer found in ${distDir}`);
  }

  installers.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs);
  return installers[0].filePath;
}

async function captureArtifact(job) {
  const sourcePath = await findInstaller();
  const jobArtifactDir = path.join(artifactRoot, job.id);
  await fsp.mkdir(jobArtifactDir, { recursive: true });

  const fileName = path.basename(sourcePath);
  const destinationPath = path.join(jobArtifactDir, fileName);

  await fsp.copyFile(sourcePath, destinationPath);
  const stats = await fsp.stat(destinationPath);
  const sha256 = await sha256ForFile(destinationPath);

  const latestMarker = {
    jobId: job.id,
    fileName,
    localPath: destinationPath,
    updatedAt: new Date().toISOString()
  };

  await fsp.writeFile(path.join(artifactRoot, 'latest.json'), `${JSON.stringify(latestMarker, null, 2)}\n`, 'utf8');

  return {
    fileName,
    localPath: destinationPath,
    size: stats.size,
    sha256
  };
}

async function runBuild(job) {
  activeJobId = job.id;
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  await persistJob(job);

  const logPath = path.join(logsDir, `${job.id}.log`);
  job.logPath = logPath;
  await persistJob(job);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  try {
    await removeDistIfRequested(job);

    const commands = [];
    if (job.installRequested && installCommand) {
      commands.push(installCommand);
    }
    commands.push(job.command);

    const commandString = commands.join(' && ');
    appendLog(logStream, `Starting build command: ${commandString}\n`);
    const shell = getShellInvocation(commandString);

    await new Promise((resolve, reject) => {
      const child = spawn(shell.command, shell.args, {
        cwd: repoRoot,
        env: {
          ...process.env,
          FORCE_COLOR: '0'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout.on('data', (chunk) => {
        logStream.write(chunk);
      });

      child.stderr.on('data', (chunk) => {
        logStream.write(chunk);
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`Build command exited with code ${code}`));
      });
    });

    job.artifact = await captureArtifact(job);
    job.status = 'succeeded';
    job.finishedAt = new Date().toISOString();
    job.exitCode = 0;
    latestSuccessfulJobId = job.id;
    await persistJob(job);
  } catch (error) {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.exitCode = job.exitCode ?? 1;
    job.error = error.message;
    appendLog(logStream, `${error.stack || error.message}\n`);
    await persistJob(job);
  } finally {
    activeJobId = null;
    logStream.end();
  }
}

async function handleCreateBuild(req, res, url) {
  if (!ensureAuthorized(req, res, url)) {
    return;
  }

  if (activeJobId) {
    const runningJob = getJob(activeJobId);
    json(res, 409, {
      error: 'A build is already running',
      activeJob: createJobResponse(runningJob, buildBaseUrl(req, url))
    });
    return;
  }

  let body = {};
  try {
    body = await parseJsonBody(req);
  } catch (error) {
    json(res, 400, { error: error.message });
    return;
  }

  const job = {
    id: generateJobId(),
    status: 'queued',
    version: packageJson.version,
    createdAt: new Date().toISOString(),
    cleanDist: body.cleanDist !== false,
    installRequested: Boolean(body.installDependencies),
    command: typeof body.command === 'string' && body.command.trim() ? body.command.trim() : buildCommand
  };

  jobs.set(job.id, job);
  await persistJob(job);
  runBuild(job).catch((error) => {
    console.error('Unexpected build failure:', error);
  });

  json(res, 202, {
    message: 'Build started',
    job: createJobResponse(job, buildBaseUrl(req, url))
  });
}

async function handleGetBuild(req, res, url, jobId) {
  if (!ensureAuthorized(req, res, url)) {
    return;
  }

  const job = getJob(jobId);
  if (!job) {
    notFound(res);
    return;
  }

  json(res, 200, createJobResponse(job, buildBaseUrl(req, url)));
}

async function handleGetBuildLogs(req, res, url, jobId) {
  if (!ensureAuthorized(req, res, url)) {
    return;
  }

  const job = getJob(jobId);
  if (!job || !job.logPath) {
    notFound(res);
    return;
  }

  try {
    const contents = await fsp.readFile(job.logPath, 'utf8');
    text(res, 200, contents);
  } catch {
    notFound(res);
  }
}

async function streamFileDownload(res, filePath, downloadName) {
  const stats = await fsp.stat(filePath);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stats.size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      json(res, 500, { error: 'Failed to stream artifact' });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

async function handleGetBuildArtifact(req, res, url, jobId) {
  if (!ensureAuthorized(req, res, url)) {
    return;
  }

  const job = getJob(jobId);
  if (!job || !job.artifact) {
    notFound(res);
    return;
  }

  await streamFileDownload(res, job.artifact.localPath, job.artifact.fileName);
}

async function handleGetLatestArtifact(req, res, url) {
  if (!ensureAuthorized(req, res, url)) {
    return;
  }

  if (!latestSuccessfulJobId) {
    json(res, 404, { error: 'No successful artifact is available yet' });
    return;
  }

  const job = getJob(latestSuccessfulJobId);
  if (!job || !job.artifact) {
    json(res, 404, { error: 'Latest artifact metadata is missing' });
    return;
  }

  await streamFileDownload(res, job.artifact.localPath, job.artifact.fileName);
}

async function handleListBuilds(req, res, url) {
  if (!ensureAuthorized(req, res, url)) {
    return;
  }

  const baseUrl = buildBaseUrl(req, url);
  const parsedLimit = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(50, parsedLimit))
    : 20;
  json(res, 200, {
    jobs: selectJobs(limit).map((job) => createJobResponse(job, baseUrl)),
    activeJobId,
    latestSuccessfulJobId
  });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    json(res, 200, {
      status: 'ok',
      version: packageJson.version,
      activeJobId,
      latestSuccessfulJobId
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/') {
    json(res, 200, {
      name: 'cubecloud-build-service',
      version: packageJson.version,
      endpoints: {
        health: 'GET /healthz',
        listBuilds: 'GET /builds',
        createBuild: 'POST /builds',
        buildStatus: 'GET /builds/:id',
        buildLogs: 'GET /builds/:id/logs',
        buildArtifact: 'GET /builds/:id/artifact',
        latestArtifact: 'GET /artifacts/latest'
      },
      activeJobId,
      latestSuccessfulJobId,
      artifactRoot,
      distDir,
      tokenProtected: Boolean(buildToken)
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/builds') {
    await handleListBuilds(req, res, url);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/builds') {
    await handleCreateBuild(req, res, url);
    return;
  }

  if (req.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'builds') {
    await handleGetBuild(req, res, url, pathParts[1]);
    return;
  }

  if (req.method === 'GET' && pathParts.length === 3 && pathParts[0] === 'builds' && pathParts[2] === 'logs') {
    await handleGetBuildLogs(req, res, url, pathParts[1]);
    return;
  }

  if (req.method === 'GET' && pathParts.length === 3 && pathParts[0] === 'builds' && pathParts[2] === 'artifact') {
    await handleGetBuildArtifact(req, res, url, pathParts[1]);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/artifacts/latest') {
    await handleGetLatestArtifact(req, res, url);
    return;
  }

  notFound(res);
}

async function main() {
  await ensureDirectories();
  await loadJobs();

  const server = http.createServer((req, res) => {
    requestHandler(req, res).catch((error) => {
      console.error('Request failed:', error);
      json(res, 500, { error: 'Internal server error', detail: error.message });
    });
  });

  server.listen(port, host, () => {
    console.log(`Build service listening on http://${host}:${port}`);
    console.log(`Artifact directory: ${artifactRoot}`);
    console.log(`State directory: ${stateRoot}`);
  });
}

main().catch((error) => {
  console.error('Failed to start build service:', error);
  process.exitCode = 1;
});