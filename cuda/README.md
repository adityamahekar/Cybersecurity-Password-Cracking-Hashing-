# CUDA brute-force matcher

One thread per candidate password. Each thread derives its guess from its global
index, hashes it on the device with a hand-rolled SHA-256, and compares against
the target. The first match is recorded with `atomicMin`.

## Build

```bash
make                      # uses -arch=native
make ARCH=sm_86           # or name your architecture explicitly
```

Requires CUDA toolkit 11.5+ (`nvcc --version`). `-arch=native` is supported from
CUDA 11.5; on older toolkits pass the arch yourself, e.g. `ARCH=sm_75`.

## Run

```bash
./build/hashcrack --target 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824 \
                  --charset abcdefghijklmnopqrstuvwxyz --length 5 --block 256
```

Outputs one JSON line:

```json
{"found":true,"password":"hello","attempts":11866175,"seconds":0.041,"rate":289418902,"device":"NVIDIA GeForce RTX 4070","block":256,"grid":65535}
```

The Express server picks this up automatically: it looks for `cuda/build/hashcrack`
and, if present, runs it and reports **measured** GPU timings. Without it the API
falls back to a clearly-labelled model.

## Notes

- SHA-256 only. SHA-1 and MD5 runs stay on the CPU path.
- Messages up to 55 bytes are handled in a single block, which covers the
  password lengths this project uses (1–12 characters).
- Grid size 0 means "auto": one block per 256 candidates, capped at 65535 blocks.
  Each thread then strides through the keyspace, so coverage is still complete.
