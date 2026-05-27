// AudioWorkletProcessor that downsamples the microphone stream to 16 kHz
// mono Int16 PCM (the format the Gemini Live API expects) and posts each
// chunk to the main thread as a transferable ArrayBuffer.
//
// Why an AudioWorklet:
//   ScriptProcessorNode is deprecated and runs on the main thread, which
//   produces audible glitches during garbage collection. AudioWorklet runs
//   on the rendering thread and is the modern replacement.
//
// The browser's AudioContext sample rate is whatever the OS gives us
// (usually 44.1k or 48k). We downsample to 16k with a simple linear
// resampler — quality is fine for speech and the cost is negligible.

class PcmDownsamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const targetSampleRate = options?.processorOptions?.targetSampleRate ?? 16000;
    this.targetSampleRate = targetSampleRate;
    this.ratio = sampleRate / targetSampleRate;
    this.buffer = [];
    this.processCount = 0;
    // Flush every ~80 ms so the model receives a steady stream
    this.flushThreshold = Math.floor(targetSampleRate * 0.08);
    this.port.postMessage({ type: "ready", sampleRate, ratio: this.ratio });
  }

  process(inputs) {
    this.processCount++;
    const input = inputs[0];
    const channel = input && input[0];
    const hasAudio = channel && channel.length > 0;

    // Diagnostic: report shape periodically so the main thread can tell us
    // whether we're getting actual audio frames or empty buffers.
    if (
      this.processCount === 1 ||
      this.processCount === 50 ||
      this.processCount === 200 ||
      this.processCount % 500 === 0
    ) {
      let peak = 0;
      if (hasAudio) {
        for (let i = 0; i < channel.length; i++) {
          const v = Math.abs(channel[i]);
          if (v > peak) peak = v;
        }
      }
      this.port.postMessage({
        type: "diag",
        n: this.processCount,
        inputs: inputs.length,
        channels: input ? input.length : 0,
        frames: channel ? channel.length : 0,
        peak: peak.toFixed(4),
        bufferLen: this.buffer.length,
        flushThreshold: this.flushThreshold,
      });
    }

    if (!hasAudio) return true;

    // Linear downsample
    for (let i = 0; i < channel.length; i += this.ratio) {
      const idx = Math.floor(i);
      const sample = channel[idx];
      const clamped = Math.max(-1, Math.min(1, sample));
      this.buffer.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
    }

    if (this.buffer.length >= this.flushThreshold) {
      const out = new Int16Array(this.buffer.length);
      for (let i = 0; i < this.buffer.length; i++) out[i] = this.buffer[i] | 0;
      this.buffer = [];
      this.port.postMessage(out.buffer, [out.buffer]);
    }

    return true;
  }
}

registerProcessor("flh-pcm-downsampler", PcmDownsamplerProcessor);
