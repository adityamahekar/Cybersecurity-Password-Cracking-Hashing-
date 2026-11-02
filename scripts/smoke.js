// End-to-end smoke test: starts the API, hashes a known password, cracks it,
// and prints the comparison. Run with: node scripts/smoke.js
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const BASE = 'http://localhost:4000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Plain http.request rather than fetch: undici's WASM parser is unavailable in
// some restricted environments, and this keeps the smoke test dependency-free.
function req(method, pathName, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const request = http.request(
      BASE + pathName,
      {
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('bad json: ' + data.slice(0, 200)));
          }
        });
      }
    );
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function waitForServer(tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await req('GET', '/api/health');
      if (res && res.ok) return res;
    } catch (err) {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('server did not start');
}

async function main() {
  const server = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..', 'server'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '4000' },
  });
  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    const health = await waitForServer();
    console.log('health:', JSON.stringify({ cores: health.cores, cuda: health.cuda.mode }));

    const hashRes = await req('POST', '/api/hash', { plaintext: 'hello', algorithm: 'sha256' });
    console.log('hash of "hello":', hashRes.hash);

    const job = await req('POST', '/api/jobs', {
      algorithm: 'sha256',
      targetHash: hashRes.hash,
      charset: 'abcdefghijklmnopqrstuvwxyz',
      length: Number(process.argv[2] || 4),
      threads: Number(process.argv[3] || 0),
      mode: 'both',
    });
    console.log('job:', job.jobId, 'keyspace:', job.total);

    let state = null;
    for (let i = 0; i < 600; i += 1) {
      state = await req('GET', `/api/jobs/${job.jobId}`);
      if (state.status !== 'running') break;
      await sleep(300);
    }

    console.log('status:', state.status);
    console.log(JSON.stringify(state.result, null, 2));
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
