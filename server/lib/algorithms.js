'use strict';

// Node's crypto names, plus the digest length so the API can reject a hash
// that could never match.
const ALGORITHMS = {
  sha256: { id: 'sha256', label: 'SHA-256', node: 'sha256', hexLength: 64 },
  sha1: { id: 'sha1', label: 'SHA-1', node: 'sha1', hexLength: 40 },
  md5: { id: 'md5', label: 'MD5', node: 'md5', hexLength: 32 },
};

function getAlgorithm(id) {
  const algo = ALGORITHMS[String(id || 'sha256').toLowerCase()];
  if (!algo) {
    const err = new Error(`Unsupported algorithm: ${id}`);
    err.status = 400;
    throw err;
  }
  return algo;
}

module.exports = { ALGORITHMS, getAlgorithm };
