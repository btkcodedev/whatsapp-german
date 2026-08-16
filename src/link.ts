/**
 * link.ts — ONE-TIME local setup
 *
 * Run this on your own machine, pointed at the SAME MONGODB_URI your
 * GitHub Actions workflow uses, to scan the QR once and save the session
 * to MongoDB. After it prints "Linked!", stop it (Ctrl+C) — the daily
 * workflow will pick the session up from Mongo and never show a QR again,
 * unless WhatsApp invalidates it (logout, 14+ days offline, etc.), in
 * which case just re-run this script.
 *
 * Usage:
 *   npm run link
 */
import { makeWASocket, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import { connectDB } from './db';
import { useMongoAuthState } from './waAuth';

dotenv.config();

async function main() {
  await connectDB();
  const { state, saveCreds } = await useMongoAuthState();

  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log('\n📱 Scan this QR with your DEDICATED WhatsApp number:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n👆 WhatsApp → Settings → Linked Devices → Link Device\n');
    }

    if (connection === 'open') {
      console.log('✅ Linked! Session saved to MongoDB.');
      console.log('👉 You can stop this now (Ctrl+C) and deploy the GitHub Actions workflow.');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.error('❌ Logged out. Delete the WaAuth collection in MongoDB and re-run this script.');
        process.exit(1);
      } else {
        console.log('🔄 Connection closed, reconnecting...', statusCode);
        main();
      }
    }
  });
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
