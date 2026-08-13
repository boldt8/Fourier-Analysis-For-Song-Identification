function assertPowerOfTwo(length) {
  if (length <= 0 || (length & (length - 1)) !== 0) {
    throw new Error(`FFT length must be a power of two. Received ${length}.`);
  }
}

function bitReverseIndex(index, bits) {
  let reversed = 0;
  for (let bit = 0; bit < bits; bit += 1) {
    reversed = (reversed << 1) | (index & 1);
    index >>= 1;
  }
  return reversed;
}

export function fftComplex(realInput, imaginaryInput = null) {
  const length = realInput.length;
  assertPowerOfTwo(length);

  const bits = Math.log2(length);
  const real = new Float64Array(length);
  const imaginary = new Float64Array(length);

  for (let index = 0; index < length; index += 1) {
    const reversedIndex = bitReverseIndex(index, bits);
    real[reversedIndex] = realInput[index];
    imaginary[reversedIndex] = imaginaryInput ? imaginaryInput[index] : 0;
  }

  for (let size = 2; size <= length; size <<= 1) {
    const halfSize = size >> 1;
    const phaseStep = (-2 * Math.PI) / size;

    for (let start = 0; start < length; start += size) {
      for (let offset = 0; offset < halfSize; offset += 1) {
        const angle = phaseStep * offset;
        const twiddleReal = Math.cos(angle);
        const twiddleImaginary = Math.sin(angle);

        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfSize;

        const oddReal = real[oddIndex];
        const oddImaginary = imaginary[oddIndex];

        const tempReal = (oddReal * twiddleReal) - (oddImaginary * twiddleImaginary);
        const tempImaginary = (oddReal * twiddleImaginary) + (oddImaginary * twiddleReal);

        real[oddIndex] = real[evenIndex] - tempReal;
        imaginary[oddIndex] = imaginary[evenIndex] - tempImaginary;
        real[evenIndex] += tempReal;
        imaginary[evenIndex] += tempImaginary;
      }
    }
  }

  return { real, imaginary };
}

export function realFftMagnitude(input) {
  const { real, imaginary } = fftComplex(input);
  const halfLength = (input.length >> 1) + 1;
  const magnitude = new Float32Array(halfLength);

  for (let index = 0; index < halfLength; index += 1) {
    magnitude[index] = Math.hypot(real[index], imaginary[index]);
  }

  return magnitude;
}
