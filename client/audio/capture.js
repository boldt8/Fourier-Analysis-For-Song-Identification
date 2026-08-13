function concatenateChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

export async function startCapture({ onChunk }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const context = new AudioContext();
  await context.audioWorklet.addModule("/client/audio/capture-worklet.js");
  await context.resume();

  const sourceNode = context.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(context, "capture-processor");
  const silentNode = context.createGain();
  silentNode.gain.value = 0;

  const chunks = [];
  workletNode.port.onmessage = (event) => {
    const chunk = event.data;
    chunks.push(chunk);
    onChunk?.(chunk, context.sampleRate);
  };

  sourceNode.connect(workletNode);
  workletNode.connect(silentNode);
  silentNode.connect(context.destination);

  return {
    inputSampleRate: context.sampleRate,
    async stop() {
      sourceNode.disconnect();
      workletNode.disconnect();
      silentNode.disconnect();

      for (const track of stream.getTracks()) {
        track.stop();
      }

      await context.close();

      return {
        samples: concatenateChunks(chunks),
        sampleRate: context.sampleRate,
      };
    },
  };
}
