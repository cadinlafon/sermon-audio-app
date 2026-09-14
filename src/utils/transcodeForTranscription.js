// Produces a small, speech-optimized MP3 copy of an uploaded audio file,
// entirely client-side — this is what lets AI summaries work on long
// sermons despite Groq's 25MB-per-request cap on the free tier. Whisper
// resamples everything to 16kHz internally regardless of input, so
// encoding straight to 16kHz mono loses nothing for transcription.
// Bitrate backs off automatically for unusually long recordings (see
// chooseBitrateKbps) so even a multi-hour recording stays under the
// cap in one file — no chunking/multiple-requests needed.
//
// Decoding uses the browser's native (fast) decoder; resampling uses
// OfflineAudioContext (also native, not a JS loop); only the actual MP3
// encoding is CPU-heavy JS work, so that part runs in a Web Worker to
// avoid freezing the upload tab.

const TARGET_SAMPLE_RATE = 16000;
// Bitrate scales down for unusually long recordings so a single file
// stays under Groq's 25MB cap without needing multiple files/requests
// — 24kbps covers anything up to ~2h25m; the lower tiers exist for the
// rare longer service and stay well within a floor that's still
// intelligible for speech (Whisper is quite robust on low-bitrate
// audio; a text summary doesn't need music-grade fidelity).
const BITRATE_TIERS_KBPS = [24, 20, 16, 12, 8];
const SAFE_UPLOAD_BYTES = 23 * 1024 * 1024; // headroom under Groq's 25MB cap

function chooseBitrateKbps(durationSeconds) {
  for (const kbps of BITRATE_TIERS_KBPS) {
    const estimatedBytes = (durationSeconds * kbps * 1000) / 8;
    if (estimatedBytes <= SAFE_UPLOAD_BYTES) return kbps;
  }
  return BITRATE_TIERS_KBPS[BITRATE_TIERS_KBPS.length - 1];
}

function floatTo16BitPCM(float32Array) {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

async function decodeToMonoPCM(file, sampleRate) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Audio decoding isn't supported in this browser.");

  const arrayBuffer = await file.arrayBuffer();
  const decodeCtx = new AudioContextClass();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    decodeCtx.close();
  }

  // A single-channel OfflineAudioContext both downmixes to mono and
  // resamples to `sampleRate` during rendering — no custom DSP needed.
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate) + 1, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return { float32: rendered.getChannelData(0), duration: decoded.duration };
}

function encodeInWorker(pcm16, sampleRate, bitrateKbps, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/mp3Encoder.worker.js", import.meta.url), { type: "module" });

    worker.onmessage = (event) => {
      const { type } = event.data;
      if (type === "progress") {
        onProgress?.(event.data.progress);
      } else if (type === "done") {
        worker.terminate();
        resolve(event.data.blob);
      } else if (type === "error") {
        worker.terminate();
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };

    worker.postMessage({ pcm16, sampleRate, bitrateKbps }, [pcm16.buffer]);
  });
}

// Returns a File ready to upload, or throws — callers should treat a
// failure here as non-fatal (log it and fall back to the original
// audio for transcription) rather than blocking the upload itself.
export async function createTranscriptionCopy(file, onProgress) {
  const { float32, duration } = await decodeToMonoPCM(file, TARGET_SAMPLE_RATE);
  const bitrateKbps = chooseBitrateKbps(duration);
  const pcm16 = floatTo16BitPCM(float32);
  const blob = await encodeInWorker(pcm16, TARGET_SAMPLE_RATE, bitrateKbps, onProgress);
  return new File([blob], "transcription-copy.mp3", { type: "audio/mp3" });
}
