import { unzipSync } from "fflate";

////////////////////////////////////////////////////////////////
// Turns whatever an admin drops/selects (loose files, a folder,
// or a .zip) into a flat list of plain audio Files, ready to
// hand off to the same uploadPrivateAudio() the single-file
// upload flow already uses.
////////////////////////////////////////////////////////////////

const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "aac", "flac"];

const EXTENSION_MIME = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
};

function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

export function isAudioFileName(name) {
  return AUDIO_EXTENSIONS.includes(extensionOf(name));
}

function isZipFileName(name) {
  return extensionOf(name) === "zip";
}

////////////////////////////////////////////////////////////////
// ZIP EXTRACTION
////////////////////////////////////////////////////////////////

async function filesFromZip(zipFile) {
  const buffer = new Uint8Array(await zipFile.arrayBuffer());
  const entries = unzipSync(buffer, {
    filter: (entry) => !entry.name.endsWith("/") && isAudioFileName(entry.name),
  });

  return Object.entries(entries).map(([path, bytes]) => {
    const name = path.split("/").pop();
    const ext = extensionOf(name);
    return new File([bytes], name, { type: EXTENSION_MIME[ext] || "audio/mpeg" });
  });
}

////////////////////////////////////////////////////////////////
// FOLDER TRAVERSAL (drag-and-drop of a directory)
////////////////////////////////////////////////////////////////

function readAllDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    const all = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

function fileFromEntry(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry, out) {
  if (entry.isFile) {
    const file = await fileFromEntry(entry);
    out.push(file);
  } else if (entry.isDirectory) {
    const children = await readAllDirectoryEntries(entry.createReader());
    for (const child of children) {
      await walkEntry(child, out);
    }
  }
}

// Reads a DataTransferItemList from a drop event, expanding any
// dropped folders into their contained files.
export async function filesFromDataTransferItems(items) {
  const out = [];
  const entries = Array.from(items)
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter(Boolean);

  if (entries.length === 0) return out;

  for (const entry of entries) {
    await walkEntry(entry, out);
  }

  return out;
}

////////////////////////////////////////////////////////////////
// NORMALIZE — expand zips, drop non-audio files
////////////////////////////////////////////////////////////////

export async function expandToAudioFiles(rawFiles) {
  const result = [];

  for (const file of rawFiles) {
    if (isZipFileName(file.name)) {
      result.push(...(await filesFromZip(file)));
    } else if (isAudioFileName(file.name)) {
      result.push(file);
    }
    // anything else (System files, .txt notes, etc.) is silently skipped
  }

  return result;
}

////////////////////////////////////////////////////////////////
// TITLE GUESS
////////////////////////////////////////////////////////////////

export function guessTitleFromFileName(name) {
  const withoutExt = name.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

////////////////////////////////////////////////////////////////
// DURATION
////////////////////////////////////////////////////////////////

export function detectAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.addEventListener(
      "loadedmetadata",
      () => {
        resolve(Number.isFinite(audio.duration) ? Math.floor(audio.duration) : null);
        URL.revokeObjectURL(objectUrl);
      },
      { once: true }
    );
    audio.addEventListener(
      "error",
      () => {
        resolve(null);
        URL.revokeObjectURL(objectUrl);
      },
      { once: true }
    );
  });
}
