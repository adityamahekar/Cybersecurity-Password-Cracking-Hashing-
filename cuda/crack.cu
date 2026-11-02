// GPU brute-force SHA-256 matcher.
//
// One thread per candidate password: the thread builds its own guess from its
// global index, hashes it on the device, and compares against the target.
// Prints a single JSON line on stdout, which server/lib/cuda.js parses.
//
// Build:  make          (produces build/hashcrack)
// Run:    ./build/hashcrack --target <hex> --charset abc --length 5 --block 256 --grid 0

#include <cuda_runtime.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

__constant__ unsigned int K[64] = {
  0x428a2f98u,0x71374491u,0xb5c0fbcFu,0xe9b5dba5u,0x3956c25Bu,0x59f111f1u,0x923f82a4u,0xab1c5ed5u,
  0xd807aa98u,0x12835b01u,0x243185beu,0x550c7dc3u,0x72be5d74u,0x80deb1feu,0x9bdc06a7u,0xc19bf174u,
  0xe49b69c1u,0xefbe4786u,0x0fc19dc6u,0x240ca1ccu,0x2de92c6fu,0x4a7484aau,0x5cb0a9dcu,0x76f988dau,
  0x983e5152u,0xa831c66du,0xb00327c8u,0xbf597fc7u,0xc6e00bf3u,0xd5a79147u,0x06ca6351u,0x14292967u,
  0x27b70a85u,0x2e1b2138u,0x4d2c6dfcu,0x53380d13u,0x650a7354u,0x766a0abbu,0x81c2c92eu,0x92722c85u,
  0xa2bfe8a1u,0xa81a664bu,0xc24b8b70u,0xc76c51a3u,0xd192e819u,0xd6990624u,0xf40e3585u,0x106aa070u,
  0x19a4c116u,0x1e376c08u,0x2748774cu,0x34b0bcb5u,0x391c0cb3u,0x4ed8aa4au,0x5b9cca4fu,0x682e6ff3u,
  0x748f82eeu,0x78a5636fu,0x84c87814u,0x8cc70208u,0x90befffau,0xa4506cebu,0xbef9a3f7u,0xc67178f2u
};

__device__ __forceinline__ unsigned int rotr(unsigned int x, int n) {
  return (x >> n) | (x << (32 - n));
}

// Messages are short (<= 55 bytes) so a single 512-bit block always suffices.
__device__ void sha256_hash(const unsigned char *msg, int len, unsigned int *digest) {
  unsigned int h[8] = {
    0x6a09e667u,0xbb67ae85u,0x3c6ef372u,0xa54ff53au,
    0x510e527fu,0x9b05688cu,0x1f83d9abu,0x5be0cd19u
  };

  unsigned char block[64];
#pragma unroll
  for (int i = 0; i < 64; i++) block[i] = 0;
  for (int i = 0; i < len; i++) block[i] = msg[i];
  block[len] = 0x80;

  unsigned long long bits = (unsigned long long)len * 8ULL;
  block[63] = (unsigned char)(bits & 0xff);
  block[62] = (unsigned char)((bits >> 8) & 0xff);
  block[61] = (unsigned char)((bits >> 16) & 0xff);
  block[60] = (unsigned char)((bits >> 24) & 0xff);

  unsigned int w[64];
#pragma unroll
  for (int i = 0; i < 16; i++) {
    w[i] = ((unsigned int)block[i * 4] << 24) | ((unsigned int)block[i * 4 + 1] << 16) |
           ((unsigned int)block[i * 4 + 2] << 8) | (unsigned int)block[i * 4 + 3];
  }
  for (int i = 16; i < 64; i++) {
    unsigned int s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
    unsigned int s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
    w[i] = w[i - 16] + s0 + w[i - 7] + s1;
  }

  unsigned int a = h[0], b = h[1], c = h[2], d = h[3];
  unsigned int e = h[4], f = h[5], g = h[6], hh = h[7];

  for (int i = 0; i < 64; i++) {
    unsigned int S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    unsigned int ch = (e & f) ^ ((~e) & g);
    unsigned int t1 = hh + S1 + ch + K[i] + w[i];
    unsigned int S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    unsigned int maj = (a & b) ^ (a & c) ^ (b & c);
    unsigned int t2 = S0 + maj;
    hh = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + t2;
  }

  digest[0] = h[0] + a; digest[1] = h[1] + b; digest[2] = h[2] + c; digest[3] = h[3] + d;
  digest[4] = h[4] + e; digest[5] = h[5] + f; digest[6] = h[6] + g; digest[7] = h[7] + hh;
}

__global__ void crack_kernel(const char *charset, int base, int len,
                             unsigned long long total, const unsigned int *target,
                             unsigned long long *foundIndex) {
  unsigned long long idx = (unsigned long long)blockIdx.x * blockDim.x + threadIdx.x;
  unsigned long long stride = (unsigned long long)gridDim.x * blockDim.x;

  for (; idx < total; idx += stride) {
    char pw[24];
    unsigned long long n = idx;
    for (int p = len - 1; p >= 0; p--) {
      pw[p] = charset[n % (unsigned long long)base];
      n /= (unsigned long long)base;
    }

    unsigned int digest[8];
    sha256_hash((const unsigned char *)pw, len, digest);

    bool match = true;
    for (int i = 0; i < 8; i++) {
      if (digest[i] != target[i]) { match = false; break; }
    }
    if (match) {
      atomicMin(foundIndex, idx);
      return;
    }
  }
}

static void hex_to_words(const char *hex, unsigned int *out) {
  for (int i = 0; i < 8; i++) {
    unsigned int v = 0;
    for (int j = 0; j < 8; j++) {
      char c = hex[i * 8 + j];
      unsigned int d = (c >= '0' && c <= '9') ? (unsigned int)(c - '0') : (unsigned int)((c | 32) - 'a' + 10);
      v = (v << 4) | d;
    }
    out[i] = v;
  }
}

int main(int argc, char **argv) {
  const char *target = NULL;
  const char *charset = "abcdefghijklmnopqrstuvwxyz";
  int len = 5;
  int block = 256;
  int grid = 0;

  for (int i = 1; i < argc; i++) {
    if (!strcmp(argv[i], "--target") && i + 1 < argc) target = argv[++i];
    else if (!strcmp(argv[i], "--charset") && i + 1 < argc) charset = argv[++i];
    else if (!strcmp(argv[i], "--length") && i + 1 < argc) len = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--block") && i + 1 < argc) block = atoi(argv[++i]);
    else if (!strcmp(argv[i], "--grid") && i + 1 < argc) grid = atoi(argv[++i]);
  }

  if (!target || strlen(target) != 64) {
    fprintf(stderr, "usage: hashcrack --target <64 hex chars> [--charset abc] [--length 5] [--block 256] [--grid 0]\n");
    return 2;
  }
  if (len < 1 || len > 20) { fprintf(stderr, "length must be 1..20\n"); return 2; }

  int base = (int)strlen(charset);
  unsigned long long total = 1;
  for (int i = 0; i < len; i++) total *= (unsigned long long)base;

  int device = 0;
  cudaDeviceProp prop;
  cudaGetDeviceProperties(&prop, device);

  unsigned int h_target[8];
  hex_to_words(target, h_target);

  char *d_charset = NULL;
  unsigned int *d_target = NULL;
  unsigned long long *d_found = NULL;
  cudaMalloc(&d_charset, base + 1);
  cudaMalloc(&d_target, sizeof(unsigned int) * 8);
  cudaMalloc(&d_found, sizeof(unsigned long long));
  cudaMemcpy(d_charset, charset, base + 1, cudaMemcpyHostToDevice);
  cudaMemcpy(d_target, h_target, sizeof(unsigned int) * 8, cudaMemcpyHostToDevice);

  unsigned long long notFound = ~0ULL;
  cudaMemcpy(d_found, &notFound, sizeof(unsigned long long), cudaMemcpyHostToDevice);

  if (grid <= 0) {
    unsigned long long blocks = (total + block - 1) / block;
    grid = (int)(blocks > 65535 ? 65535 : blocks);
    if (grid < 1) grid = 1;
  }

  cudaEvent_t start, stop;
  cudaEventCreate(&start);
  cudaEventCreate(&stop);
  cudaEventRecord(start);

  crack_kernel<<<grid, block>>>(d_charset, base, len, total, d_target, d_found);

  cudaEventRecord(stop);
  cudaEventSynchronize(stop);
  float ms = 0.0f;
  cudaEventElapsedTime(&ms, start, stop);

  cudaError_t err = cudaGetLastError();
  if (err != cudaSuccess) {
    fprintf(stderr, "kernel error: %s\n", cudaGetErrorString(err));
    return 1;
  }

  unsigned long long found = notFound;
  cudaMemcpy(&found, d_found, sizeof(unsigned long long), cudaMemcpyDeviceToHost);

  double seconds = (double)ms / 1000.0;
  if (seconds <= 0.0) seconds = 1e-6;

  char password[32] = {0};
  unsigned long long attempts = total;
  bool matched = (found != notFound);

  if (matched) {
    unsigned long long n = found;
    for (int p = len - 1; p >= 0; p--) {
      password[p] = charset[n % (unsigned long long)base];
      n /= (unsigned long long)base;
    }
    attempts = found + 1;
  }

  double rate = (double)attempts / seconds;

  printf("{\"found\":%s,\"password\":\"%s\",\"attempts\":%llu,\"seconds\":%.6f,\"rate\":%.0f,\"device\":\"%s\",\"block\":%d,\"grid\":%d}\n",
         matched ? "true" : "false", password, attempts, seconds, rate, prop.name, block, grid);

  cudaFree(d_charset);
  cudaFree(d_target);
  cudaFree(d_found);
  return 0;
}
