'use strict';

// Bridge to the native CUDA binary.
//
// If cuda/build/hashcrack exists it is executed and its output is measured.
// Otherwise the GPU figure is *modelled* from the measured CPU rate and the
// response says so explicitly, so a simulated number can never be mistaken
// for a benchmark.
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const BINARY = path.resolve(__dirname, '../../cuda/build/hashcrack');

// Conservative factor for a small brute-force job: a mid-range GPU against a
// few CPU cores. Deliberately modest — the real binary will beat it easily.
const MODEL_FACTOR = 40;
const MODEL_CAP = 2.14e9; // hashes/sec ceiling for the model

function cudaStatus() {
  const available = fs.existsSync(BINARY);
  return {
    available,
    mode: available ? 'measured' : 'modelled',
    binary: available ? BINARY : null,
    message: available
      ? 'Native CUDA binary found — GPU timings are measured.'
      : 'No CUDA binary at cuda/build/hashcrack — GPU timings are modelled from the measured CPU rate.',
  };
}

function runMeasured({ algorithm, target, charset, length, blockSize, gridSize }) {
  return new Promise((resolve, reject) => {
    const args = [
      '--algorithm', algorithm,
      '--target', target,
      '--charset', charset,
      '--length', String(length),
      '--block', String(blockSize || 256),
      '--grid', String(gridSize || 0),
    ];
    execFile(BINARY, args, { timeout: 300000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(err);
      try {
        const parsed = JSON.parse(String(stdout).trim().split('\n').pop());
        resolve({
          found: Boolean(parsed.found),
          password: parsed.password || null,
          attempts: Number(parsed.attempts) || 0,
          seconds: Number(parsed.seconds) || 0,
          rate: Number(parsed.rate) || 0,
          simulated: false,
          note: `Measured on device: ${parsed.device || 'CUDA device'}`,
          stderr: stderr || '',
        });
      } catch (e) {
        reject(new Error(`Could not parse CUDA output: ${stdout || e.message}`));
      }
    });
  });
}

function runModelled({ attempts, cpuRate }) {
  const base = cpuRate > 0 ? cpuRate : 400000;
  const rate = Math.min(base * MODEL_FACTOR, MODEL_CAP);
  const seconds = attempts / rate;
  return {
    found: null, // caller fills in: the same password is found either way
    password: null,
    attempts,
    seconds,
    rate,
    simulated: true,
    note: 'Modelled: no CUDA binary present. Build cuda/ to replace this with a measurement.',
  };
}

async function runGpu(opts) {
  const status = cudaStatus();
  // The native binary implements SHA-256 only; other digests stay on the CPU path.
  const supported = String(opts.algorithm).toLowerCase() === 'sha256';
  if (status.available && supported) {
    const measured = await runMeasured(opts);
    return measured;
  }
  return runModelled(opts);
}

module.exports = { runGpu, cudaStatus };
