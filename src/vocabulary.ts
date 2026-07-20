import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const PROGRESS_FILE = path.resolve('data/progress.json');

interface WordOfTheDay {
  dayNumber: number;
  german: string;
  article: string | null;      // der / die / das / null (for verbs/adjectives)
  partOfSpeech: string;        // noun, verb, adjective, etc.
  english: string;
  pronunciation: string;       // phonetic hint e.g. "tseː"
  example: string;             // example sentence in German
  exampleTranslation: string;  // English translation of example
  memoryTip: string;           // mnemonic or fun tip to remember it
  topic: string;               // A1 topic area e.g. "Greetings", "Family", "Food"
}

interface Progress {
  currentDay: number;
  wordsUsed: string[];  // keeps track of words already sent to avoid repeats
}

function getProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { currentDay: 1, wordsUsed: [] };
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// A1 curriculum topics to cycle through
const A1_TOPICS = [
  'Greetings & Farewells',
  'Numbers & Counting',
  'Colors',
  'Days of the Week',
  'Months & Seasons',
  'Family Members',
  'Body Parts',
  'Food & Drinks',
  'Animals',
  'Clothes',
  'Home & Furniture',
  'Transport',
  'Weather',
  'Basic Verbs (to be, to have, to go)',
  'Common Adjectives',
  'Time & Clock',
  'Shopping & Money',
  'School & Work',
  'Countries & Nationalities',
  'Hobbies & Leisure',
];

export async function generateWordOfTheDay(): Promise<WordOfTheDay> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const progress = getProgress();
  const topic = A1_TOPICS[(progress.currentDay - 1) % A1_TOPICS.length];
  const usedWordsHint =
    progress.wordsUsed.length > 0
      ? `Avoid these already-used words: ${progress.wordsUsed.slice(-50).join(', ')}.`
      : '';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `
You are a German A1 language curriculum expert. Generate exactly ONE German A1-level vocabulary word for today's lesson.

Today's topic: "${topic}"
Day number: ${progress.currentDay}
${usedWordsHint}

Rules:
- The word MUST be appropriate for absolute beginners (CEFR A1 level).
- Pick a single, high-frequency, practical word.
- The example sentence must also use only simple A1-level German.
- The memory tip should be fun, visual, or use English word associations.

Respond with a single JSON object matching this exact schema:
{
  "dayNumber": ${progress.currentDay},
  "german": "the German word (base form, e.g. essen, groß, der Apfel)",
  "article": "der | die | das | null (null for verbs, adjectives, adverbs)",
  "partOfSpeech": "noun | verb | adjective | adverb | phrase",
  "english": "English translation",
  "pronunciation": "simple phonetic hint for English speakers, e.g. ESS-en",
  "example": "Ein einfacher deutscher Satz.",
  "exampleTranslation": "English translation of the example sentence.",
  "memoryTip": "A fun tip to remember this word.",
  "topic": "${topic}"
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let word: WordOfTheDay;
  try {
    word = JSON.parse(text);
  } catch {
    // Strip markdown code fences if Gemini adds them
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      word = JSON.parse(match[1]);
    } else {
      throw new Error(`Failed to parse Gemini response: ${text}`);
    }
  }

  // Update progress
  progress.wordsUsed.push(word.german);
  progress.currentDay++;
  saveProgress(progress);

  return word;
}

export function formatWordMessage(word: WordOfTheDay): string {
  const articleDisplay = word.article ? `${word.article} ` : '';
  const fullWord = `${articleDisplay}${word.german}`;

  return (
    `☀️ *Guten Morgen! — Word of the Day #${word.dayNumber}*\n` +
    `📚 Topic: ${word.topic}\n\n` +
    `🇩🇪 *${fullWord}* _(${word.partOfSpeech})_\n` +
    `🔊 /${word.pronunciation}/\n` +
    `🇬🇧 ${word.english}\n\n` +
    `📝 _${word.example}_\n` +
    `   → ${word.exampleTranslation}\n\n` +
    `💡 *Memory tip:* ${word.memoryTip}`
  );
}
