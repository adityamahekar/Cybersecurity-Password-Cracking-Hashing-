'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');

const { ALGORITHMS, getAlgorithm } = require('./lib/algorithms');
const { startJob, getJob, getHistory } = require('./lib/jobs');
const { cudaStatus } = require('./lib/cuda');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    cores: os.cpus().length,
    node: process.version,
    algorithms: Object.values(ALGORITHMS).map((a) => ({ id: a.id, label: a.label, hexLength: a.hexLength })),
    cuda: cudaStatus(),
  });
});

// Generate a test hash from a known plaintext. This is how a run should start:
// you pick the password, hash it, then watch the cracker rediscover it.
app.post('/api/hash', (req, res) => {
  try {
    const algo = getAlgorithm(req.body.algorithm);
    const plaintext = String(req.body.plaintext ?? '');
    if (!plaintext) {
      return res.status(400).json({ error: 'plaintext is required' });
    }
    const hash = crypto.createHash(algo.node).update(plaintext).digest('hex');
    res.json({ algorithm: algo.id, label: algo.label, plaintext, hash, hexLength: algo.hexLength });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    const started = await startJob(req.body);
    res.status(202).json(started);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json(job);
});

app.get('/api/history', (req, res) => {
  res.json({ history: getHistory() });
});

// Serve the built client when it exists, so `npm run build` gives a single
// origin for both the UI and the API.
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

app.listen(PORT, () => {
  const status = cudaStatus();
  console.log(`[hashlab] API listening on http://localhost:${PORT}`);
  console.log(`[hashlab] cores: ${os.cpus().length} · CUDA: ${status.mode}`);
  if (!status.available) console.log(`[hashlab] ${status.message}`);
});
