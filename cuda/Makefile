# Build the CUDA brute-force matcher.
#   make          -> build/hashcrack
#   make clean
NVCC ?= nvcc
ARCH ?= native

all: build/hashcrack

build/hashcrack: crack.cu
	@mkdir -p build
	$(NVCC) -O3 -std=c++14 -arch=$(ARCH) -o build/hashcrack crack.cu

clean:
	rm -rf build

.PHONY: all clean
