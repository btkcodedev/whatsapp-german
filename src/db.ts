import mongoose, { Schema } from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set in environment variables");
  if (mongoose.connection.readyState === 1) return; // already connected
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB.');
}

// ─── Channel Progress ───────────────────────────────────────────────────────
// Tracks which "day" the channel is on and which words have already been
// used, so the daily GitHub Actions run (a fresh, throwaway checkout every
// time) knows where it left off. Lives in Mongo instead of a local file
// because Actions runners have no persistent disk between runs.

export interface WordUsed {
  german: string;
  english: string;
  topic: string;
  day_number: number;
}

export interface ChannelProgressDoc {
  _id: string;         // fixed key, e.g. 'channel'
  currentDay: number;
  level: string;
  wordsUsed: WordUsed[];
}

const ChannelProgressSchema = new Schema<ChannelProgressDoc>({
  _id: { type: String, required: true },
  currentDay: { type: Number, default: 1 },
  level: { type: String, default: 'A1' },
  wordsUsed: [{ type: Schema.Types.Mixed }],
});

const ChannelProgressModel = mongoose.model<ChannelProgressDoc>('ChannelProgress', ChannelProgressSchema);

const PROGRESS_KEY = 'channel';

export async function getChannelProgress(defaultLevel: string): Promise<ChannelProgressDoc> {
  const doc = await ChannelProgressModel.findById(PROGRESS_KEY).lean();
  if (doc) return doc;
  return { _id: PROGRESS_KEY, currentDay: 1, level: defaultLevel, wordsUsed: [] };
}

export async function saveChannelProgress(progress: Omit<ChannelProgressDoc, '_id'>): Promise<void> {
  await ChannelProgressModel.updateOne(
    { _id: PROGRESS_KEY },
    { $set: progress },
    { upsert: true }
  );
}

// ─── Baileys Auth State ─────────────────────────────────────────────────────
// One document per credential/key entry, keyed the same way Baileys'
// official useMultiFileAuthState keys its files — just Mongo instead of fs.

const WaAuthSchema = new Schema({
  _id: { type: String, required: true },
  value: { type: String, required: true }, // JSON via Baileys' BufferJSON
});

export const WaAuthModel = mongoose.model('WaAuth', WaAuthSchema);
