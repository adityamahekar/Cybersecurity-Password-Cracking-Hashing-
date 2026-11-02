'use strict';

// One slice of the keyspace, run in its own OS process.
//
// A child process (rather than a worker thread) keeps a crash or an OOM in the
// hashing loop from taking the API down with it, and each child gets its own
// address space — which matters on memory-constrained machines.
//
// Config arrives as JSON in argv[2]; results go back over IPC.
const crypto = require('node:crypto');

const cfg = JSON.parse(process.argv[2]);
const { algorithm, target, charset, length, start, end, reportEvery } = cfg;
const base = charset.length;

function candidate(index) {
  let n = index;
  let out = '';
  for (let pos = 0; pos < length; pos += 1) {
    out = charset[n % base] + out;
    n = Math.floor(n / base);
  }
  return out;
}

let hashed = 0;
for (let i = start; i < end; i += 1) {
  const guess = candidate(i);
  const digest = crypto.createHash(algorithm).update(guess).digest('hex');
  hashed += 1;

  if (digest === target) {
    process.send({ type: 'found', password: guess, index: i, hashed });
    process.exit(0);
  }

  if (hashed % reportEvery === 0) {
    process.send({ type: 'progress', hashed });
  }
}

process.send({ type: 'done', hashed });
process.exit(0);
