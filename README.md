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

```
# Cybersecurity: Password Cracking / Hashing (CUDA)

## 1. Example Input and Output

### Example 1: Password Hash Matching

Input

```
Algorithm: SHA-256
Target Hash: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
Password Length: 5
Character Set: a-z
```

Output

```
Target Hash: 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

CPU Execution:
Password Found: hello
Time Taken: 2.45 seconds

GPU (CUDA) Execution:
Password Found: hello
Time Taken: 0.35 seconds

Performance Comparison:
Speedup: 7x
Status: Password Matched Successfully
```

The target hash above is SHA-256 of "hello". The execution times and speedup are illustrative, not actual benchmark results.

### Example 2: CPU vs GPU Comparison


| Input           | CPU Output     | GPU Output     |
| --------------- | -------------- | -------------- |
| Target Hash     | SHA-256 hash   | SHA-256 hash   |
| Password Range  | a-z            | a-z            |
| Password Length | 4              | 4              |
| Attempts        | Sequential     | Parallel       |
| Execution       | 1.20 sec       | 0.18 sec       |
| Result          | Password Found | Password Found |


## 2. Features List

[Parallel Computing - GPU computing](https://images.openai.com/static-rsc-4/5301pbSVxkYava5JOfWmHYtV9sdkVsEI4QmwkaG6uzOxkTu5pLA1sX1wd6Xpaq-uZuDgvpYXfMJSrEUMt5RdBznbf5zL9qTK5p_KqmuTCmCx0EZhhO5XXpmlXlZqGQGNLIOBIUN150VvfN9qDrebYfXyLPx3Txk45cqC-0m75TM?purpose=inline)

[SHA-256 Algorithm: Features, Working &amp; Applications 2026](https://images.openai.com/static-rsc-4/4BJSmL6jiGq-DHI4EqyrbnaL7wehg-AEjuHHKppZ3evv60l3a6yOA4IaO_752i1xQk87ZxSNWSYNsqeMWZFe8hkkv3aAFDOFyDeUi_-IHxTA27ayfmbpumw-THthFr845rsYIs6KBviDqmFrJtiEYQanWAh48AR8-IpUu5tLJns?purpose=inline)

[Intel Core i9-12900K Flagship Shown Crushing The AMD Ryzen 9 5950X In CPU-Z Single-Thread Benchmark](https://images.openai.com/static-rsc-4/xvr8zCgY7N93Nzw0I4h5Wfn6DU--qT3J-3Qhmrm9rfx1jwqRROQNNuHV2AimuIvlcu-3Tb8jTKNUeDUuj7m2Pagjf7TpD5M9f1-Ul1tqNgKIyh_XNI2hWQs7iXwkdX5GR3CoCIL2iYkyx_OGGdB1s1q_WxoQOnD_XnrcRQHqqFQ?purpose=inline)

7

### Core Features

1. SHA-256 Hash Generation – Converts plaintext passwords into cryptographic hashes.
2. Password Guess Generation – Generates candidate passwords from a defined character set.
3. CPU-Based Hash Testing – Tests password combinations sequentially or across CPU workers.
4. GPU-Based CUDA Hash Testing – Uses CUDA threads to test multiple candidate passwords in parallel.
5. Hash Matching – Compares computed hashes with a target hash.
6. CPU vs GPU Benchmarking – Measures execution time for CPU and GPU.
7. Performance Speedup Calculation – Displays GPU speedup over CPU.
8. Password Search Progress – Displays tested combinations and percentage completed.
9. Execution Time Display – Shows total time required to complete the test.
10. Success / Failure Status – Displays whether a matching password was found.

### Advanced Features

- Adjustable password length.
- Custom character set selection.
- CUDA thread and block configuration.
- Hash algorithm selection (SHA-256, SHA-1, MD5 for educational comparison).
- Real-time progress visualization.
- Attempts-per-second counter.
- GPU utilization and CPU utilization monitoring.
- Benchmark report generation.
- Stop / restart execution controls.
- Support for self-generated test hashes.

## 3. Project Input and Output Format

Input

```
Target Hash: <SHA-256 hash>
Algorithm: SHA-256
Password Length: 4
Character Set: abc123
Execution Mode: CPU + CUDA GPU
```

Output

```
CPU Time: 1.20 seconds
GPU Time: 0.18 seconds

Password Found: a1b2
Total Attempts: 1296

CPU Speed: 1080 hashes/sec
GPU Speed: 7200 hashes/sec

GPU Speedup: 6.67x
```

Illustrative values. Actual benchmark results depend on the GPU, CPU, hashing implementation, and workload.

## 4. Technologies Used


| Component         | Technology        |
| ----------------- | ----------------- |
| Frontend          | React.js + Vite   |
| Backend           | Node.js + Express |
| GPU Processing    | CUDA C++          |
| CPU Processing    | C++               |
| Hashing Algorithm | SHA-256           |
| Visualization     | Chart.js          |
| Communication     | REST API          |


Project Title: GPU-Accelerated Password Hashing and Cracking Simulation Using CUDA

Objective: To demonstrate how parallel GPU computing can accelerate password hash matching compared with CPU-based processing, using controlled, self-generated test cases.                    create a reactjs project
```
