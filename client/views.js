function fitCanvas(canvas) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(canvas.clientWidth * devicePixelRatio));
  const height = Math.max(180, Math.floor(canvas.clientHeight * devicePixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(devicePixelRatio, devicePixelRatio);

  return {
    context,
    width: width / devicePixelRatio,
    height: height / devicePixelRatio,
  };
}

function clearPanel(context, width, height) {
  context.clearRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(18, 26, 40, 0.96)");
  gradient.addColorStop(1, "rgba(8, 12, 22, 0.96)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawGrid(context, width, height, columns = 8, rows = 4) {
  context.save();
  context.strokeStyle = "rgba(143, 164, 194, 0.12)";
  context.lineWidth = 1;

  for (let column = 1; column < columns; column += 1) {
    const x = (column / columns) * width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let row = 1; row < rows; row += 1) {
    const y = (row / rows) * height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.restore();
}

function drawEmptyState(canvas, message) {
  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawGrid(context, width, height);

  context.fillStyle = "rgba(244, 247, 252, 0.82)";
  context.font = '600 15px "Avenir Next", "Segoe UI", sans-serif';
  context.textAlign = "center";
  context.fillText(message, width / 2, height / 2);
}

function valueToColor(value, minValue, maxValue) {
  const normalized = Math.max(0, Math.min(1, (value - minValue) / Math.max(1e-6, maxValue - minValue)));
  const red = Math.round(18 + (normalized * 237));
  const green = Math.round(36 + (normalized * 156));
  const blue = Math.round(54 + ((1 - normalized) * 124));
  return [red, green, blue];
}

function drawHeatmapBase(context, width, height, matrix) {
  const frames = matrix.length;
  const bins = matrix[0].length;
  const minValue = -90;
  const maxValue = -10;
  const offscreen = document.createElement("canvas");
  offscreen.width = frames;
  offscreen.height = bins;
  const offscreenContext = offscreen.getContext("2d");
  const image = offscreenContext.createImageData(frames, bins);

  for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
    const row = matrix[frameIndex];
    for (let binIndex = 0; binIndex < bins; binIndex += 1) {
      const [red, green, blue] = valueToColor(row[binIndex], minValue, maxValue);
      const y = bins - 1 - binIndex;
      const pixelIndex = ((y * frames) + frameIndex) * 4;
      image.data[pixelIndex] = red;
      image.data[pixelIndex + 1] = green;
      image.data[pixelIndex + 2] = blue;
      image.data[pixelIndex + 3] = 255;
    }
  }

  offscreenContext.putImageData(image, 0, 0);
  context.imageSmoothingEnabled = false;
  context.drawImage(offscreen, 0, 0, width, height);
}

function drawSelectedFrameMarker(context, width, height, frameIndex, totalFrames) {
  if (totalFrames <= 1) {
    return;
  }

  const x = (frameIndex / (totalFrames - 1)) * width;
  context.save();
  context.strokeStyle = "rgba(255, 241, 118, 0.95)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, height);
  context.stroke();
  context.restore();
}

export function renderWaveform(canvas, samples, highlightStart, highlightEnd) {
  if (!samples?.length) {
    drawEmptyState(canvas, "Record a clip or load the demo signal to see the waveform.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawGrid(context, width, height);

  if (Number.isFinite(highlightStart) && Number.isFinite(highlightEnd)) {
    const x0 = (highlightStart / samples.length) * width;
    const x1 = (highlightEnd / samples.length) * width;
    context.fillStyle = "rgba(255, 193, 110, 0.15)";
    context.fillRect(x0, 0, x1 - x0, height);
  }

  context.strokeStyle = "#7de2d1";
  context.lineWidth = 1.5;
  context.beginPath();

  for (let x = 0; x < width; x += 1) {
    const sampleIndex = Math.floor((x / width) * samples.length);
    const value = samples[sampleIndex] ?? 0;
    const y = (0.5 - (value * 0.42)) * height;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
}

export function renderFrameComparison(canvas, rawFrame, windowedFrame) {
  if (!rawFrame?.length || !windowedFrame?.length) {
    drawEmptyState(canvas, "The selected frame will appear here after analysis.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawGrid(context, width, height);

  const drawSignal = (frame, color, alphaScale = 0.4) => {
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.globalAlpha = alphaScale;
    context.beginPath();

    for (let x = 0; x < width; x += 1) {
      const sampleIndex = Math.floor((x / width) * frame.length);
      const y = (0.5 - (frame[sampleIndex] * 0.42)) * height;
      if (x === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
    context.globalAlpha = 1;
  };

  drawSignal(rawFrame, "#98b7ff", 0.45);
  drawSignal(windowedFrame, "#ffb36b", 0.95);
}

export function renderSpectrum(canvas, magnitude, minBin, maxBin, frequencyStepHz) {
  if (!magnitude?.length) {
    drawEmptyState(canvas, "FFT magnitudes will appear here after analysis.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawGrid(context, width, height);

  const dbValues = [];
  let minDb = Infinity;
  let maxDb = -Infinity;

  for (let bin = minBin; bin <= maxBin; bin += 1) {
    const dbValue = 20 * Math.log10((magnitude[bin] ?? 0) + 1e-8);
    dbValues.push(dbValue);
    minDb = Math.min(minDb, dbValue);
    maxDb = Math.max(maxDb, dbValue);
  }

  context.strokeStyle = "#ffd166";
  context.lineWidth = 2;
  context.beginPath();

  for (let index = 0; index < dbValues.length; index += 1) {
    const x = (index / Math.max(1, dbValues.length - 1)) * width;
    const normalized = (dbValues[index] - minDb) / Math.max(1e-6, maxDb - minDb);
    const y = height - (normalized * height * 0.9) - 12;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();

  context.fillStyle = "rgba(244, 247, 252, 0.86)";
  context.font = '500 13px "Avenir Next", "Segoe UI", sans-serif';
  context.fillText(`${Math.round(minBin * frequencyStepHz)} Hz`, 14, height - 12);
  context.textAlign = "right";
  context.fillText(`${Math.round(maxBin * frequencyStepHz)} Hz`, width - 14, height - 12);
  context.textAlign = "left";
}

export function renderTeachingProjection(canvas, projection, selectedBin) {
  if (!projection) {
    drawEmptyState(canvas, "Choose a frame to see how one DFT bin projects onto the signal.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawGrid(context, width, height, 8, 3);

  const topHeight = height * 0.42;
  const middleOffset = height * 0.52;

  const drawLine = (values, color, offsetY, amplitude) => {
    context.strokeStyle = color;
    context.lineWidth = 1.8;
    context.beginPath();

    for (let index = 0; index < values.length; index += 1) {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = offsetY - (values[index] * amplitude);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
  };

  drawLine(projection.signal, "#7de2d1", topHeight, topHeight * 0.7);
  drawLine(projection.basisReal, "#ffd166", topHeight, topHeight * 0.55);
  drawLine(projection.basisImaginary, "#98b7ff", topHeight, topHeight * 0.55);
  drawLine(projection.realProducts, "#ff8fab", middleOffset, height * 0.18);
  drawLine(projection.imaginaryProducts, "#7cc7ff", height * 0.83, height * 0.14);

  context.fillStyle = "rgba(244, 247, 252, 0.9)";
  context.font = '600 14px "Avenir Next", "Segoe UI", sans-serif';
  context.fillText(`Bin k = ${selectedBin}`, 16, 20);
  context.font = '500 12px "Avenir Next", "Segoe UI", sans-serif';
  context.fillText(`Real sum = ${projection.realSum.toFixed(2)}`, 16, height - 32);
  context.fillText(`Imag sum = ${projection.imaginarySum.toFixed(2)}`, 16, height - 16);
}

export function renderSpectrogram(canvas, dbSpectrogram, selectedFrame) {
  if (!dbSpectrogram?.length) {
    drawEmptyState(canvas, "The spectrogram appears after framing and FFT analysis.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawHeatmapBase(context, width, height, dbSpectrogram);
  drawSelectedFrameMarker(context, width, height, selectedFrame, dbSpectrogram.length);
}

export function renderPeaks(canvas, dbSpectrogram, peaks, selectedFrame) {
  if (!dbSpectrogram?.length) {
    drawEmptyState(canvas, "Spectral peaks appear after local-max filtering.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawHeatmapBase(context, width, height, dbSpectrogram);

  context.fillStyle = "rgba(255, 246, 190, 0.9)";
  for (const peak of peaks) {
    const x = (peak.frameIndex / Math.max(1, dbSpectrogram.length - 1)) * width;
    const y = height - ((peak.bandBinIndex / Math.max(1, dbSpectrogram[0].length - 1)) * height);
    context.beginPath();
    context.arc(x, y, 2.2, 0, Math.PI * 2);
    context.fill();
  }

  drawSelectedFrameMarker(context, width, height, selectedFrame, dbSpectrogram.length);
}

export function renderLandmarks(canvas, dbSpectrogram, peaks, landmarks, selectedFrame, minBin) {
  if (!dbSpectrogram?.length) {
    drawEmptyState(canvas, "Landmark pairs appear once anchor-target hashes are built.");
    return;
  }

  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawHeatmapBase(context, width, height, dbSpectrogram);

  const visibleLandmarks = landmarks.filter(
    (landmark) => Math.abs(landmark.anchorFrame - selectedFrame) <= 3,
  );

  context.strokeStyle = "rgba(255, 203, 107, 0.42)";
  context.lineWidth = 1.3;
  for (const landmark of visibleLandmarks) {
    const x0 = (landmark.anchorFrame / Math.max(1, dbSpectrogram.length - 1)) * width;
    const x1 = (landmark.targetFrame / Math.max(1, dbSpectrogram.length - 1)) * width;
    const y0 =
      height -
      (((landmark.anchorBin - minBin) / Math.max(1, dbSpectrogram[0].length - 1)) * height);
    const y1 =
      height -
      (((landmark.targetBin - minBin) / Math.max(1, dbSpectrogram[0].length - 1)) * height);
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  }

  context.fillStyle = "rgba(255, 246, 190, 0.9)";
  for (const peak of peaks) {
    const x = (peak.frameIndex / Math.max(1, dbSpectrogram.length - 1)) * width;
    const y = height - ((peak.bandBinIndex / Math.max(1, dbSpectrogram[0].length - 1)) * height);
    context.beginPath();
    context.arc(x, y, 1.8, 0, Math.PI * 2);
    context.fill();
  }

  drawSelectedFrameMarker(context, width, height, selectedFrame, dbSpectrogram.length);
}

export function renderMatchResult(canvas, matchResult, resultText = "Recognition backend not connected yet.") {
  const { context, width, height } = fitCanvas(canvas);
  clearPanel(context, width, height);
  drawGrid(context, width, height, 10, 4);

  if (!matchResult?.offsetHistogram?.length) {
    context.fillStyle = "rgba(244, 247, 252, 0.88)";
    context.textAlign = "center";
    context.font = '600 15px "Avenir Next", "Segoe UI", sans-serif';
    context.fillText("Offset-vote histogram", width / 2, height * 0.42);
    context.font = '500 13px "Avenir Next", "Segoe UI", sans-serif';
    context.fillText(resultText, width / 2, height * 0.58);
    context.textAlign = "left";
    return;
  }

  const maxVotes = Math.max(...matchResult.offsetHistogram.map((entry) => entry.votes), 1);
  const padding = 24;
  const baseline = height - 36;
  const barWidth = Math.max(12, (width - (padding * 2)) / matchResult.offsetHistogram.length - 6);

  matchResult.offsetHistogram.forEach((entry, index) => {
    const x = padding + (index * ((width - (padding * 2)) / matchResult.offsetHistogram.length));
    const barHeight = (entry.votes / maxVotes) * (height - 78);
    const y = baseline - barHeight;

    context.fillStyle = index === 0 ? "rgba(255, 209, 102, 0.92)" : "rgba(125, 226, 209, 0.78)";
    context.fillRect(x, y, barWidth, barHeight);

    context.fillStyle = "rgba(244, 247, 252, 0.76)";
    context.font = '500 11px "Avenir Next", "Segoe UI", sans-serif';
    context.save();
    context.translate(x + (barWidth / 2), baseline + 14);
    context.rotate(-0.45);
    context.fillText(`${entry.offsetSec}s`, 0, 0);
    context.restore();
  });

  context.fillStyle = "rgba(244, 247, 252, 0.88)";
  context.textAlign = "left";
  context.font = '600 15px "Avenir Next", "Segoe UI", sans-serif';
  context.fillText(matchResult.topMatch ? `Best: ${matchResult.topMatch.title}` : "Offset-vote histogram", 16, 22);
  context.font = '500 13px "Avenir Next", "Segoe UI", sans-serif';
  context.fillText(resultText, 16, 42);
}
