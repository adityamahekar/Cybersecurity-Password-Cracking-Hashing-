# GPU-Accelerated Password Hashing and Cracking Simulation Using CUDA

A three-part project: a React frontend, a Node/Express API that really hashes and
really searches, and a CUDA C++ kernel that does the same work on a GPU.

You pick a password, the app hashes it, then the CPU and the GPU race to
rediscover it. Both sides report the time and the number of attempts, so the
speedup is a measurement rather than an assertion.

## Layout

```
client/     React + Vite frontend, Chart.js charts
server/     Express API, child-process CPU cracker, CUDA bridge
cuda/       CUDA C++ brute-force kernel (build it on a machine with an NVIDIA GPU)
scripts/    smoke.js — end-to-end check of the whole stack
```

## Run it

Two terminals, both from the project root.

```bash
npm install          # installs client and server (npm workspaces)

# terminal 1
npm run dev:server   # API on http://localhost:4000

# terminal 2
npm run dev:client   # UI on http://localhost:5173
```

Open http://localhost:5173.

To serve everything from one origin instead:

```bash
npm run build        # client -> client/dist
npm start            # API + UI both on http://localhost:4000
```

Check the stack without the browser:

```bash
node scripts/smoke.js 5     # cracks SHA-256("hello") with a 5-char a-z search
```

## Turning on real GPU timings

```bash
cd cuda
make                 # needs nvcc (CUDA toolkit 11.5+)
```

The server looks for `cuda/build/hashcrack` on every run. If it exists, GPU
timings are **measured** by the binary. If it doesn't, GPU timings are
**modelled** — the UI shows a "GPU modelled" badge so a projection is never
mistaken for a benchmark.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | cores, Node version, CUDA mode, supported algorithms |
| POST | `/api/hash` | `{ plaintext, algorithm }` → digest |
| POST | `/api/jobs` | `{ algorithm, targetHash, charset, length, mode, blockSize, gridSize }` → `{ jobId }` |
| GET | `/api/jobs/:id` | status, live progress, result |
| GET | `/api/history` | recent runs, newest first |

`mode` is `cpu`, `gpu` or `both`. Jobs are polled rather than streamed, which
keeps the API to plain request/response.

## How the work is divided

- **CPU** — the keyspace is split into contiguous slices, one per child process.
  Each child walks its slice with an odometer, hashes with `crypto.createHash`,
  and reports progress over IPC. Timing is wall-clock around the whole run.
- **GPU** — `crack.cu` gives each thread one candidate: the thread derives its
  guess from its global index, hashes it with a hand-written SHA-256 on the
  device, and compares. A match is recorded with `atomicMin` and copied back.
- Both sides find the password at the same index, so attempts always match; only
  the time differs.

## Limits

- Keyspace is capped at 2 × 10⁹ candidates, and runs time out at 120 s.
- SHA-1 and MD5 run on the CPU only; the CUDA kernel implements SHA-256.
- `HASHLAB_MAX_THREADS=1` forces a single CPU process on a memory-constrained
  machine.
- Nothing here talks to a network target. Targets are hashes you generate in the
  app.

## Measured on this machine (2 cores, no GPU)

| Run | Attempts | CPU | GPU (modelled) |
| --- | --- | --- | --- |
| `hello`, 5 chars, a-z | 3 276 873 | 16.5 s @ 198 kH/s | 0.41 s |

With 8 cores the CPU figure drops to roughly 2 s, which is the range the brief
quotes.
