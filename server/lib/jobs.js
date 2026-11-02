'use strict';

// Tiny in-memory job registry. The client creates a job, then polls it while
// the cracker reports progress.
const crypto = require('node:crypto');
const { runCpu, keyspaceSize } = require('./cracker');
const { runGpu, cudaStatus } = require('./cuda');
const { getAlgorithm } = require('./algorithms');

const jobs = new Map();
const history = [];
const MAX_HISTORY = 25;

function newJobId() {
  return crypto.randomBytes(6).toString('hex');
}

function validate(input) {
  const algorithm = getAlgorithm(input.algorithm);
  const charset = String(input.charset || 'abcdefghijklmnopqrstuvwxyz');
  const length = Number(input.length);
  const target = String(input.targetHash || '').trim().toLowerCase();

  if (!target) throw Object.assign(new Error('targetHash is required'), { status: 400 });
  if (target.length !== algorithm.hexLength) {
    throw Object.assign(
      new Error(
        `${algorithm.label} hashes are ${algorithm.hexLength} hex characters; ` +
          `this target is ${target.length}.`
      ),
      { status: 400 }
    );
  }
  if (!/^[0-9a-f]+$/.test(target)) {
    throw Object.assign(new Error('targetHash must be hexadecimal'), { status: 400 });
  }
  if (!Number.isInteger(length) || length < 1 || length > 12) {
    throw Object.assign(new Error('length must be an integer between 1 and 12'), { status: 400 });
  }
  if (charset.length < 2) {
    throw Object.assign(new Error('charset needs at least two characters'), { status: 400 });
  }
  if (new Set(charset).size !== charset.length) {
    throw Object.assign(new Error('charset contains duplicate characters'), { status: 400 });
  }

  return {
    algorithm,
    target,
    charset,
    length,
    mode: input.mode === 'gpu' ? 'gpu' : input.mode === 'cpu' ? 'cpu' : 'both',
    threads: Number(input.threads) || 0,
    blockSize: Number(input.blockSize) || 256,
    gridSize: Number(input.gridSize) || 0,
    maxSeconds: Math.min(Number(input.maxSeconds) || 120, 600),
  };
}

async function startJob(rawInput) {
  const input = validate(rawInput);
  const id = newJobId();
  const total = keyspaceSize(input.charset, input.length);

  const job = {
    id,
    input: {
      algorithm: input.algorithm.id,
      algorithmLabel: input.algorithm.label,
      targetHash: input.target,
      charset: input.charset,
      length: input.length,
      mode: input.mode,
      blockSize: input.blockSize,
      gridSize: input.gridSize,
    },
    status: 'running',
    phase: 'cpu',
    total,
    progress: { attempts: 0, percent: 0, rate: 0, elapsed: 0 },
    cpu: null,
    gpu: null,
    result: null,
    error: null,
    startedAt: new Date().toISOString(),
    cuda: cudaStatus(),
  };
  jobs.set(id, job);

  // run in the background; the client polls
  (async () => {
    try {
      if (input.mode !== 'gpu') {
        job.phase = 'cpu';
        const cpu = await runCpu({
          algorithm: input.algorithm.node,
          target: input.target,
          charset: input.charset,
          length: input.length,
          threads: input.threads,
          maxSeconds: input.maxSeconds,
          onProgress: (p) => {
            job.progress = p;
          },
        });
        job.cpu = cpu;
        job.progress = {
          attempts: cpu.attempts,
          total,
          percent: cpu.found ? (cpu.attempts / total) * 100 : 100,
          rate: cpu.rate,
          elapsed: cpu.seconds,
        };
      }

      const attempts = job.cpu ? job.cpu.attempts : total;
      const password = job.cpu ? job.cpu.password : null;

      if (input.mode !== 'cpu') {
        job.phase = 'gpu';
        const gpu = await runGpu({
          algorithm: input.algorithm.id,
          target: input.target,
          charset: input.charset,
          length: input.length,
          attempts,
          cpuRate: job.cpu ? job.cpu.rate : 0,
          blockSize: input.blockSize,
          gridSize: input.gridSize,
        });
        job.gpu = { ...gpu, found: password ? true : gpu.found, password: password || gpu.password };
      }

      job.status = 'done';
      job.phase = 'idle';
      job.result = buildResult(job);

      history.unshift(job.result);
      if (history.length > MAX_HISTORY) history.pop();
    } catch (err) {
      job.status = 'error';
      job.error = err.message;
    }
  })();

  return { jobId: id, total, cuda: job.cuda };
}

function buildResult(job) {
  const { cpu, gpu } = job;
  const speedup = cpu && gpu && gpu.seconds > 0 ? cpu.seconds / gpu.seconds : null;
  return {
    id: job.id,
    input: job.input,
    total: job.total,
    status: job.cpu && job.cpu.found ? 'matched' : job.cpu && job.cpu.stopped === 'timeout' ? 'timeout' : 'not-found',
    password: cpu ? cpu.password : null,
    attempts: cpu ? cpu.attempts : job.total,
    cpu: cpu
      ? { seconds: cpu.seconds, rate: cpu.rate, attempts: cpu.attempts, found: cpu.found }
      : null,
    gpu: gpu
      ? {
          seconds: gpu.seconds,
          rate: gpu.rate,
          attempts: gpu.attempts,
          found: gpu.found,
          simulated: gpu.simulated,
          note: gpu.note,
        }
      : null,
    speedup,
    createdAt: new Date().toISOString(),
  };
}

function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    total: job.total,
    progress: job.progress,
    input: job.input,
    cpu: job.cpu,
    gpu: job.gpu,
    result: job.result,
    error: job.error,
    cuda: job.cuda,
  };
}

function getHistory() {
  return history;
}

module.exports = { startJob, getJob, getHistory };
