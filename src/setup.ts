/**
 * ONE-TIME SETUP SCRIPT
 * Run this locally to scan the QR code and generate the .wwebjs_auth session.
 * After it prints "✅ Session ready!", copy the base64 string and save it
 * as a GitHub Secret named WWEBJS_AUTH.
 *
 * Usage:
 *   npm run setup
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

import fs from 'fs';

const AUTH_DIR = path.resolve('.wwebjs_auth');

console.log('🔧 WhatsApp Authentication Setup');
console.log('=================================\n');

// Clean up any existing session first
if (fs.existsSync(AUTH_DIR)) {
  console.log('🧹 Cleaning up old session...');
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  console.log('✅ Old session removed\n');
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
  puppeteer: {
    headless: false, // show browser so you can see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  },
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
  }
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

  // Wait a moment for session to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Package the session for GitHub Secrets
  try {
    console.log('📦 Packaging session data...');
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
    console.log('\n👉 For Render.com: Add as environment variable');
    console.log('   Name:  WWEBJS_AUTH');
    console.log('   Value: (paste the string above)');
  } catch (e) {
    console.error('❌ Could not auto-encode session:', e.message);
    console.log('\n💡 Manual method:');
    console.log('   1. Run: tar -czf wwebjs_auth.tar.gz -C .wwebjs_auth .');
    console.log('   2. Run: base64 -i wwebjs_auth.tar.gz');
    console.log('   3. Copy the output as WWEBJS_AUTH');
  }

  await client.destroy();
  
  // Force exit after cleanup
  setTimeout(() => {
    console.log('\n✅ Setup complete! Exiting...');
    process.exit(0);
  }, 1000);
});

client.on('auth_failure', (msg) => {
  console.error('❌ Auth failed:', msg);
  setTimeout(() => process.exit(1), 1000);
});

client.on('disconnected', (reason) => {
  console.log('📱 Disconnected:', reason);
  if (reason !== 'LOGOUT') {
    console.log('⚠️  Unexpected disconnect, but session should be saved');
    setTimeout(() => process.exit(0), 1000);
  }
});

console.log('🔧 Initializing WhatsApp client...');
console.log('⏳ This may take a minute...\n');

client.initialize();
