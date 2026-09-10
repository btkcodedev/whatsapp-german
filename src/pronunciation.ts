/**
 * pronunciation.ts — audio for a German word, as an Ogg/Opus voice note
 *
 * Two sources, tried in order:
 *   1. A native-speaker recording of that exact word from German Wiktionary
 *      (volunteer-recorded, hosted on Wikimedia Commons). Best quality, but
 *      not every word has one.
 *   2. Piper, a local neural text-to-speech model that runs inside the job
 *      itself (no API, no key, no cost). Speaks the exact word Gemini chose.
 *      Covers everything Wiktionary doesn't. Needs `piper` on PATH and a
 *      voice; PIPER_DATA_DIR points at the downloaded voice model.
 *
 * Everything here is best-effort. Any failure (no recording, Piper not
 * installed, ffmpeg missing, network error) returns null and never throws —
 * the daily text post must not depend on this.
 */
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { readFile, unlink } from 'fs/promises';

const UA = 'whatsapp-german/1.0 (https://github.com/btkcodedev/whatsapp-german)';
const PIPER_VOICE = process.env.PIPER_VOICE || 'de_DE-thorsten-medium';

export async function getPronunciationOpus(
  germanWord: string,
  exampleSentence?: string
): Promise<Buffer | null> {
  const fromWiktionary = await tryWiktionary(germanWord);
  if (fromWiktionary) {
    console.log(`Pronunciation: native-speaker recording for "${germanWord}".`);
    return fromWiktionary;
  }

  const fromPiper = await tryPiper(germanWord, exampleSentence);
  if (fromPiper) {
    console.log(`Pronunciation: Piper TTS for "${germanWord}".`);
    return fromPiper;
  }

  console.warn(`No pronunciation available for "${germanWord}" (text still posts).`);
  return null;
}

// ─── Source 1: Wiktionary native-speaker recording ─────────────────────────

async function tryWiktionary(word: string): Promise<Buffer | null> {
  try {
    const fileName = await findAudioFile(word);
    if (!fileName) return null;
    const vorbis = await downloadCommonsFile(fileName);
    if (!vorbis) return null;
    return await transcodeToOpus(vorbis);
  } catch (err) {
    console.warn(`Wiktionary lookup failed for "${word}": ${msg(err)}`);
    return null;
  }
}

/** Parse the Wiktionary page wikitext for a {{Audio|De-...ogg}} clip of the word. */
async function findAudioFile(word: string): Promise<string | null> {
  const url =
    `https://de.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}` +
    `&prop=wikitext&format=json&formatversion=2`;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;

  const json: any = await res.json();
  const wikitext: string = json?.parse?.wikitext ?? '';

  const candidates = [...wikitext.matchAll(/\{\{Audio\|([^|}]+)/g)]
    .map((m) => m[1].trim())
    .filter((f) => /\.ogg$/i.test(f) && /^De-/i.test(f)); // standard German recordings only

  if (candidates.length === 0) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß]/g, '');
  const target = norm(word);

  // Only accept a clip whose name IS the word ("De-Haus.ogg", "De-Haus2.ogg",
  // "De-at-Haus.ogg"). Never a phrase clip ("De-ein rotes Haus.ogg") or a
  // different word — a mismatched pronunciation is worse than none.
  const exact = candidates.find((f) => {
    const stem = f.replace(/^De-(at-|ch-)?/i, '').replace(/2?\.ogg$/i, '');
    return norm(stem) === target;
  });
  return exact ?? null;
}

async function downloadCommonsFile(fileName: string): Promise<Buffer | null> {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 0 ? buf : null;
}

// ─── Source 2: Piper local neural TTS ──────────────────────────────────────

async function tryPiper(word: string, example?: string): Promise<Buffer | null> {
  // A lone word can sound clipped; the example sentence gives natural prosody.
  const text = example ? `${word}. ${example}` : word;
  const wav = await runPiper(text);
  if (!wav) return null;
  try {
    return await transcodeToOpus(wav);
  } catch (err) {
    console.warn(`Piper transcode failed: ${msg(err)}`);
    return null;
  }
}

/** Run Piper, return the WAV bytes, or null if Piper isn't installed / errors. */
async function runPiper(text: string): Promise<Buffer | null> {
  const bin = process.env.PIPER_BIN || 'piper';
  const args = ['--model', PIPER_VOICE];
  if (process.env.PIPER_DATA_DIR) args.push('--data-dir', process.env.PIPER_DATA_DIR);

  const wavPath = join(tmpdir(), `piper-${randomBytes(6).toString('hex')}.wav`);
  args.push('--output_file', wavPath);

  try {
    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn(bin, args);
      const killer = setTimeout(() => { p.kill('SIGKILL'); resolve(false); }, 45_000);
      p.on('error', () => { clearTimeout(killer); resolve(false); }); // not installed
      p.on('close', (code) => { clearTimeout(killer); resolve(code === 0); });
      p.stdin.on('error', () => {});
      p.stdin.write(text);
      p.stdin.end();
    });
    if (!ok) return null;
    return await readFile(wavPath);
  } catch {
    return null;
  } finally {
    unlink(wavPath).catch(() => {});
  }
}

// ─── Shared: transcode anything ffmpeg can read to Ogg/Opus ────────────────

function transcodeToOpus(input: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    ff.stdout.on('data', (d) => chunks.push(d));
    ff.on('error', () => resolve(null)); // ffmpeg not on PATH
    ff.on('close', (code) => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null));
    ff.stdin.on('error', () => {}); // swallow EPIPE if ffmpeg exits early

    ff.stdin.write(input);
    ff.stdin.end();
  });
}

const msg = (e: unknown) => (e as any)?.message || String(e);
