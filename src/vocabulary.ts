import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// ─── Types ─────────────────────────────────────────────────────────────────

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface WordOfTheDay {
  dayNumber: number;
  german: string;
  article: string | null;
  partOfSpeech: string;
  english: string;
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  memoryTip: string;
  topic: string;
  level: CEFRLevel;
  // Optional: Gemini might add a callback to a past word
  callbackToPastWord?: string;
}

export interface FlashCard {
  german: string;
  english: string;
  question: string;     // e.g. "How do you say 'apple' in German?"
  hint: string;         // e.g. "It's a fruit 🍎"
  answer: string;       // e.g. "der Apfel"
  explanation: string;  // e.g. "You learned this on Day 3! 'Apfel' sounds like 'apple'."
}

// ─── Level-specific topic trees ────────────────────────────────────────────

const TOPICS: Record<CEFRLevel, string[]> = {
  A1: [
    'Greetings & Farewells', 'Introductions', 'Numbers 1–20', 'Colors', 'Days of the Week',
    'Months & Seasons', 'Family Members', 'Body Parts', 'Food & Drinks', 'Animals',
    'Clothes', 'Home & Furniture', 'Transport', 'Weather', 'Basic Verbs (sein, haben, gehen)',
    'Common Adjectives', 'Time & Clock', 'Shopping & Money', 'Countries & Nationalities', 'Hobbies',
  ],
  A2: [
    'Daily Routines', 'Work & Professions', 'Health & Body', 'Directions & Places', 'Past Tense (Perfekt)',
    'Future Plans', 'Travel & Holidays', 'At the Restaurant', 'Numbers 100+', 'Describing People',
    'Emotions & Feelings', 'Housing & Apartment', 'Banking & Post Office', 'Weather & Seasons (extended)',
    'Modal Verbs (können, müssen, wollen)', 'Phone & Communication', 'Sports', 'Invitations & Events',
  ],
  B1: [
    'Opinions & Arguments', 'Media & News', 'Education & University', 'Culture & Traditions',
    'Subjunctive (Konjunktiv II)', 'Passive Voice', 'Relative Clauses', 'Complex Adjectives',
    'Environment & Nature', 'Politics & Society (basic)', 'Job Applications', 'Complex Prepositions',
    'Separable & Inseparable Verbs', 'Two-way Prepositions (Wechselpräpositionen)',
  ],
  B2: [
    'Formal Writing', 'Abstract Nouns', 'Advanced Passive Constructions', 'Extended Relative Clauses',
    'Economy & Business', 'Science & Technology', 'Idioms & Collocations', 'Advanced Konjunktiv',
    'Participle Constructions', 'Media Analysis', 'Argumentation & Debate',
  ],
  C1: [
    'Academic Register', 'Complex Subordinate Clauses', 'Nominalization', 'Nuanced Connectors',
    'Literature & Art', 'Philosophy & Ethics', 'Law & Society', 'Advanced Word Formation',
    'Regional Variants', 'Stylistic Devices', 'Dense Compound Nouns',
  ],
  C2: [
    'Archaic & Literary Language', 'Rare Idioms', 'Fine Stylistic Distinctions', 'Complex Ellipsis',
    'Subtle Register Differences', 'Intertextuality', 'Advanced Rhetoric',
  ],
};

// ─── Vocabulary generation with Gemini memory ──────────────────────────────

export async function generateWord(
  dayNumber: number,
  level: CEFRLevel,
  wordHistory: Array<{ german: string; english: string; topic: string; day_number: number }>
): Promise<WordOfTheDay> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.7-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const topics = TOPICS[level];
  const todayTopic = topics[(dayNumber - 1) % topics.length];
  const usedGerman = wordHistory.map((w) => w.german);

  // Build a memory summary for Gemini
  const memoryBlock =
    wordHistory.length > 0
      ? `Previously taught words (DO NOT repeat these):\n${wordHistory
          .slice(-40)
          .map((w) => `  Day ${w.day_number}: "${w.german}" = ${w.english} [${w.topic}]`)
          .join('\n')}`
      : 'No words have been taught yet. This is Day 1!';

  // Find a good candidate for callback (a word from 3–10 days ago, same topic if possible)
  const callbackCandidate = wordHistory.find(
    (w) => w.topic === todayTopic && dayNumber - w.day_number >= 3
  ) || wordHistory[Math.floor(wordHistory.length / 2)];

  const callbackInstruction = callbackCandidate
    ? `You may optionally create a "callbackToPastWord" sentence that references "${callbackCandidate.german}" (${callbackCandidate.english}) taught on Day ${callbackCandidate.day_number}. For example: "You already know '${callbackCandidate.german}' — today's word pairs naturally with it!"`
    : '';

  const prompt = `
You are a certified German language teacher building a CEFR ${level}-level daily word curriculum.

Today: Day ${dayNumber} | Level: ${level} | Topic: "${todayTopic}"

${memoryBlock}

${callbackInstruction}

Pick ONE new high-frequency German word that:
- Is strictly ${level} level (not easier, not harder)
- Belongs to the topic "${todayTopic}"
- Has NOT been taught before (avoid: ${usedGerman.slice(-20).join(', ') || 'none yet'})

Respond with ONLY a valid JSON object matching this schema exactly:
{
  "dayNumber": ${dayNumber},
  "german": "base form of the word",
  "article": "der | die | das | null (null for verbs/adjectives)",
  "partOfSpeech": "noun | verb | adjective | adverb | phrase",
  "english": "concise English translation",
  "pronunciation": "simple phonetic for English speakers, e.g. BROW-chen",
  "example": "A simple ${level}-appropriate example sentence in German.",
  "exampleTranslation": "English translation of the example sentence.",
  "memoryTip": "A vivid, memorable tip — use imagery, wordplay, or English cognates.",
  "topic": "${todayTopic}",
  "level": "${level}",
  "callbackToPastWord": "Optional: a fun sentence referencing a past word, or null"
}
`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error(`Could not parse Gemini response: ${raw.substring(0, 200)}`);
  }
}

// ─── Flashcard generation ──────────────────────────────────────────────────

export async function generateFlashcard(
  wordHistory: Array<{ german: string; english: string; topic: string; day_number: number }>,
  weakWords: Array<{ german: string; english: string; wrong_count: number }>,
  level: CEFRLevel
): Promise<FlashCard> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  if (wordHistory.length === 0) {
    throw new Error('No words learned yet — learn some words first!');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.7-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  // Prioritize weak words, fall back to random from history
  const targetPool =
    weakWords.length > 0
      ? weakWords
      : wordHistory.slice(-20);

  const target = targetPool[Math.floor(Math.random() * targetPool.length)];

  const prompt = `
You are a German language teacher creating a flashcard quiz for a ${level}-level learner.

Target word: "${target.german}" = "${target.english}"
Learner's vocabulary (words they know): ${wordHistory.map((w) => w.german).join(', ')}

Create a short, engaging quiz question. Vary the question type (translation, fill-in-the-blank, choose the article, context clue, etc.).

Respond ONLY with a JSON object:
{
  "german": "${target.german}",
  "english": "${target.english}",
  "question": "The quiz question for the learner (in English or German depending on the quiz type)",
  "hint": "A small hint (an emoji or 1-3 word clue, not the answer)",
  "answer": "The correct answer",
  "explanation": "A short explanation after answering — reference when they learned it and reinforce the memory tip"
}
`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error(`Could not parse flashcard response: ${raw.substring(0, 200)}`);
  }
}

// ─── Message formatters ────────────────────────────────────────────────────

export function formatWordMessage(word: WordOfTheDay): string {
  const display = word.article ? `${word.article} ${word.german}` : word.german;
  const levelBadge = `[${word.level}]`;
  const callback = word.callbackToPastWord
    ? `\n🔗 ${word.callbackToPastWord}`
    : '';

  return (
    `☀️ *Guten Morgen! — Word #${word.dayNumber}* ${levelBadge}\n` +
    `📚 Topic: ${word.topic}\n\n` +
    `🇩🇪 *${display}* _(${word.partOfSpeech})_\n` +
    `🔊 /${word.pronunciation}/\n` +
    `🇬🇧 ${word.english}\n\n` +
    `📝 _${word.example}_\n` +
    `   → ${word.exampleTranslation}\n\n` +
    `💡 *Tip:* ${word.memoryTip}` +
    callback +
    `\n\n📲 DM the bot: *more* (extra words) | *flashcard* (quiz) | *level* (change level)`
  );
}

export function formatFlashcardQuestion(card: FlashCard): string {
  return (
    `🃏 *Flashcard Time!*\n\n` +
    `❓ ${card.question}\n\n` +
    `💡 Hint: ${card.hint}\n\n` +
    `Reply with your answer!`
  );
}

export function formatFlashcardResult(card: FlashCard, userAnswer: string): string {
  const normalized = (s: string) => s.trim().toLowerCase().replace(/[^\w\säöü]/gi, '');
  const correct = normalized(userAnswer) === normalized(card.answer);

  return correct
    ? `✅ *Richtig!* (Correct!)\n\n📖 ${card.explanation}`
    : `❌ *Falsch.* The answer was: *${card.answer}*\n\n📖 ${card.explanation}`;
}
