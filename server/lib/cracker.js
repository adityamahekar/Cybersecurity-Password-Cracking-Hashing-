'use strict';

// CPU hash testing: splits the keyspace across child processes and measures
// wall-clock time, so the number reported is a real measurement on this box.
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const MAX_KEYSPACE = 2e9; // refuse anything that would run for days

// Each child is a full Node process. Cap it, and let a constrained machine ask
// for fewer: HASHLAB_MAX_THREADS=1 runs a single process.
const MAX_THREADS = Math.max(1, Number(process.env.HASHLAB_MAX_THREADS) || 8);

function keyspaceSize(charset, length) {
  return Math.pow(charset.length, length);
}

function runCpu({ algorithm, target, charset, length, threads, maxSeconds = 120, onProgress }) {
  return new Promise((resolve, reject) => {
    const total = keyspaceSize(charset, length);
    if (!Number.isFinite(total) || total <= 0) {
      return reject(Object.assign(new Error('Invalid keyspace'), { status: 400 }));
    }
    if (total > MAX_KEYSPACE) {
      return reject(
        Object.assign(
          new Error(
            `Keyspace of ${total.toExponential(2)} is too large for a demo run. ` +
              `Shorten the password or reduce the character set.`
          ),
          { status: 400 }
        )
      );
    }

    const childCount = Math.max(1, Math.min(threads || os.cpus().length, MAX_THREADS, total));
    const children = [];
    let hashed = 0;
    let finished = false;
    let exited = 0;
    const reported = new Map(); // child index -> last cumulative count it sent

    // Children report running totals, so the parent has to convert them to
    // deltas before adding them to the global counter.
    function addHashed(childIndex, cumulative) {
      const previous = reported.get(childIndex) || 0;
      hashed += cumulative - previous;
      reported.set(childIndex, cumulative);
    }
    const startedAt = process.hrtime.bigint();
    let lastReport = 0;
    const reportEvery = Math.max(2048, Math.floor(total / 2000));

    const elapsedSeconds = () => Number(process.hrtime.bigint() - startedAt) / 1e9;

    function emitProgress(force) {
      const now = Date.now();
      if (!force && now - lastReport < 150) return;
      lastReport = now;
      const seconds = elapsedSeconds();
      if (onProgress) {
        onProgress({
          attempts: hashed,
          total,
          percent: Math.min(100, (hashed / total) * 100),
          rate: seconds > 0 ? hashed / seconds : 0,
          elapsed: seconds,
        });
      }
    }

    function cleanup() {
      children.forEach((c) => {
        try {
          if (c.connected) c.kill('SIGKILL');
        } catch (err) {
          /* already gone */
        }
      });
    }

    function finish(result) {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    }

    const timer = setTimeout(() => {
      if (finished) return;
      const seconds = elapsedSeconds();
      finish({
        found: false,
        password: null,
        attempts: hashed,
        seconds,
        rate: seconds > 0 ? hashed / seconds : 0,
        stopped: 'timeout',
      });
    }, maxSeconds * 1000);

    for (let i = 0; i < childCount; i += 1) {
      const start = Math.floor((i * total) / childCount);
      const end = Math.floor(((i + 1) * total) / childCount);
      if (end <= start) continue;

      const cfg = JSON.stringify({ algorithm, target, charset, length, start, end, reportEvery });
      const child = fork(path.join(__dirname, 'crack-child.js'), [cfg], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      children.push(child);

      child.on('message', (msg) => {
        if (msg.type === 'progress') {
          addHashed(i, msg.hashed);
          emitProgress(false);
        } else if (msg.type === 'found') {
          addHashed(i, msg.hashed);
          const seconds = elapsedSeconds();
          clearTimeout(timer);
          emitProgress(true);
          finish({
            found: true,
            password: msg.password,
            attempts: hashed,
            seconds,
            rate: seconds > 0 ? hashed / seconds : 0,
            index: msg.index,
          });
        } else if (msg.type === 'done') {
          addHashed(i, msg.hashed);
          emitProgress(false);
        }
      });

      child.on('error', (err) => {
        if (finished) return;
        clearTimeout(timer);
        cleanup();
        reject(err);
      });

      child.on('exit', () => {
        exited += 1;
        if (finished) return;
        if (exited === children.length) {
          clearTimeout(timer);
          const seconds = elapsedSeconds();
          finish({
            found: false,
            password: null,
            attempts: hashed,
            seconds,
            rate: seconds > 0 ? hashed / seconds : 0,
            stopped: 'exhausted',
          });
        }
      });
    }

    if (children.length === 0) {
      clearTimeout(timer);
      reject(Object.assign(new Error('No workers started'), { status: 500 }));
    }
  });
}

module.exports = { runCpu, keyspaceSize, MAX_KEYSPACE };
