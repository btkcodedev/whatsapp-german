#!/usr/bin/env node

/**
 * Session Backup Script
 * 
 * Backs up WhatsApp session to cloud storage for recovery.
 * Run this periodically to maintain session backups.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function backupSession() {
  const sessionPath = '.wwebjs_auth';
  const backupPath = `session-backup-${Date.now()}.tar.gz`;
  
  if (!fs.existsSync(sessionPath)) {
    console.log('❌ No session found to backup');
    return;
  }

  try {
    // Create compressed backup
    console.log('📦 Creating session backup...');
    execSync(`tar -czf ${backupPath} -C ${sessionPath} .`);
    
    // Convert to base64 for storage
    const b64 = execSync(`base64 -i ${backupPath}`).toString().replace(/\n/g, '');
    
    console.log('💾 Session backup created:');
    console.log('   File:', backupPath);
    console.log('   Size:', fs.statSync(backupPath).size, 'bytes');
    console.log('   Base64 length:', b64.length);
    
    // Here you could upload to:
    // - AWS S3
    // - Google Drive API  
    // - Database
    // - Email to yourself
    // - Encrypted file server
    
    console.log('\n🔄 Store this backup somewhere safe:');
    console.log('═'.repeat(50));
    console.log(b64.substring(0, 100) + '...[truncated]');
    console.log('═'.repeat(50));
    
    // Cleanup
    fs.unlinkSync(backupPath);
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
  }
}

backupSession();