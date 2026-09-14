import { Mp3Encoder } from "lamejs";

// Runs off the main thread since encoding a long sermon (even at a low
// bitrate) is real CPU work — without a worker, this would freeze the
// upload tab for however long encoding takes.
self.onmessage = (event) => {
  const { pcm16, sampleRate, bitrateKbps } = event.data;

  try {
    const encoder = new Mp3Encoder(1, sampleRate, bitrateKbps);
    const chunks = [];
    const blockSize = 1152; // lamejs's required frame size for encodeBuffer
    const total = pcm16.length;

    for (let i = 0; i < total; i += blockSize) {
      const block = pcm16.subarray(i, i + blockSize);
      const encoded = encoder.encodeBuffer(block);
      if (encoded.length > 0) chunks.push(encoded);

      // Progress updates every ~2% instead of every block — posting a
      // message per 1152-sample block would itself become a bottleneck.
      if (i % (blockSize * 200) === 0) {
        self.postMessage({ type: "progress", progress: i / total });
      }
    }

    const finalChunk = encoder.flush();
    if (finalChunk.length > 0) chunks.push(finalChunk);

    const blob = new Blob(chunks, { type: "audio/mp3" });
    self.postMessage({ type: "done", blob });
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message || "MP3 encoding failed." });
  }
};
