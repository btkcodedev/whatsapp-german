import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import { generateWordOfTheDay, formatWordMessage } from './vocabulary';

dotenv.config();

async function postWordOfTheDay() {
  const CHANNEL_ID = process.env.CHANNEL_ID;
  if (!CHANNEL_ID) throw new Error('CHANNEL_ID is not set in environment variables.');

  // 1. Generate word via Gemini
  console.log('🤖 Generating today\'s word via Gemini...');
  const word = await generateWordOfTheDay();
  const message = formatWordMessage(word);
  console.log(`📖 Word of the Day: "${word.german}" (${word.english})`);
  console.log('\n── Message Preview ──\n' + message + '\n─────────────────────\n');

  // 2. Connect to WhatsApp and post
  return new Promise<void>((resolve, reject) => {
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });

    let posted = false;

    client.on('qr', (qr) => {
      console.log('\n📱 First-time setup: Scan this QR code with WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', async () => {
      console.log('✅ WhatsApp connected!');
      try {
        const channel = await client.getNewsletterById(CHANNEL_ID);
        await channel.sendMessage(message);
        console.log('✅ Posted to channel successfully!');
        posted = true;
        await client.destroy();
        resolve();
      } catch (err) {
        await client.destroy();
        reject(err);
      }
    });

    client.on('auth_failure', async (msg) => {
      console.error('❌ Auth failure:', msg);
      await client.destroy();
      reject(new Error('WhatsApp authentication failed'));
    });

    client.initialize();

    // Safety timeout: 2 minutes
    setTimeout(async () => {
      if (!posted) {
        console.error('⏰ Timeout: could not connect within 2 minutes.');
        await client.destroy();
        reject(new Error('Timeout'));
      }
    }, 120_000);
  });
}

postWordOfTheDay()
  .then(() => { console.log('✅ Done!'); process.exit(0); })
  .catch((err) => { console.error('❌ Error:', err.message); process.exit(1); });
