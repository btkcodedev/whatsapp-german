/**
 * ONE-TIME SETUP SCRIPT
 * Run this locally to scan the QR code and generate the .wwebjs_auth session.
 * After it prints "✅ Session ready!", copy the base64 string and save it
 * as a GitHub Secret named WWEBJS_AUTH.
 *
 * Usage:
 *   npx ts-node src/setup.ts
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { execSync } from 'child_process';
import path from 'path';

const AUTH_DIR = path.resolve('.wwebjs_auth');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
  puppeteer: {
    headless: false, // show browser so you can see what's happening
    args: ['--no-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with your DEDICATED WhatsApp number:\n');
  qrcode.generate(qr, { small: true });
  console.log('\nWaiting for scan...\n');
});

client.on('authenticated', () => {
  console.log('✅ Authenticated! Saving session...');
});

client.on('ready', async () => {
  console.log('✅ Client is ready!\n');

  // Package the session for GitHub Secrets
  try {
    execSync(`tar -czf wwebjs_auth.tar.gz -C ${AUTH_DIR} .`);
    const b64 = execSync('base64 -i wwebjs_auth.tar.gz').toString().replace(/\n/g, '');

    console.log('═'.repeat(60));
    console.log('📋 COPY THIS BASE64 STRING AND SAVE IT AS GITHUB SECRET: WWEBJS_AUTH');
    console.log('═'.repeat(60));
    console.log(b64);
    console.log('═'.repeat(60));
    console.log('\n👉 Go to: GitHub Repo → Settings → Secrets → Actions → New secret');
    console.log('   Name:  WWEBJS_AUTH');
    console.log('   Value: (paste the string above)');
  } catch (e) {
    console.error('Could not auto-encode session. Manually zip .wwebjs_auth and base64 encode it.');
  }

  await client.destroy();
  process.exit(0);
});

client.on('auth_failure', (msg) => {
  console.error('❌ Auth failed:', msg);
  process.exit(1);
});

client.initialize();
