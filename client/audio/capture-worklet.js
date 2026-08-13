class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channelData = inputs[0]?.[0];
    if (channelData) {
      this.port.postMessage(channelData.slice());
    }

    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
