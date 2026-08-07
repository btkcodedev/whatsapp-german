#!/usr/bin/env node

/**
 * Re-authentication Script
 * 
 * Run this when your WhatsApp session expires to generate a new WWEBJS_AUTH token.
 * This is a simplified version of setup.ts for quick re-authentication.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 WhatsApp Re-authentication Tool');
console.log('===================================\n');

// Clean up old session
const authDir = '.wwebjs_auth';
if (fs.existsSync(authDir)) {
  console.log('🧹 Cleaning up old session...');
  fs.rmSync(authDir, { recursive: true, force: true });
}

console.log('📱 Starting authentication process...\n');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: authDir }),
  puppeteer: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
  }
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with your WhatsApp number:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n👆 Open WhatsApp → Settings → Linked Devices → Link Device');
  console.log('⏳ Waiting for scan...\n');
});

client.on('authenticated', () => {
  console.log('✅ Authentication successful!');
});

client.on('ready', async () => {
  console.log('✅ WhatsApp Web connected!\n');

  // Wait for session to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Create the base64 encoded session
    console.log('📦 Packaging session data...');
    execSync(`tar -czf wwebjs_auth_new.tar.gz -C ${authDir} .`);
    const b64 = execSync('base64 -i wwebjs_auth_new.tar.gz').toString().replace(/\n/g, '');

    console.log('\n' + '═'.repeat(70));
    console.log('🔑 NEW WWEBJS_AUTH TOKEN');
    console.log('═'.repeat(70));
    console.log(b64);
    console.log('═'.repeat(70));
    console.log('\n📋 COPY THE TOKEN ABOVE AND UPDATE:');
    console.log('   • GitHub Secret: WWEBJS_AUTH');
    console.log('   • Render Environment Variable: WWEBJS_AUTH');
    console.log('   • Local .env file: WWEBJS_AUTH\n');

    // Clean up
    if (fs.existsSync('wwebjs_auth_new.tar.gz')) {
      fs.unlinkSync('wwebjs_auth_new.tar.gz');
    }

  } catch (error) {
    console.error('❌ Error creating session package:', error.message);
  }

  await client.destroy();
  setTimeout(() => {
    console.log('✅ Re-authentication complete!');
    process.exit(0);
  }, 1000);
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  setTimeout(() => process.exit(1), 1000);
});

client.on('disconnected', (reason) => {
  console.log('📱 Disconnected:', reason);
  if (reason !== 'LOGOUT') {
    console.log('⚠️  Unexpected disconnect, but session should be saved');
  }
});

// Add timeout
setTimeout(() => {
  console.log('⏱️  Timeout: QR code was not scanned within 2 minutes');
  process.exit(1);
}, 120000);

console.log('🔧 Initializing client...\n');
client.initialize();