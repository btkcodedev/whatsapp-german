#!/usr/bin/env node

/**
 * Health Check Script
 * 
 * Monitors the health of your WhatsApp bot deployment.
 * Can be run locally or set up as a monitoring cron job.
 */

const https = require('https');
const fs = require('fs');

const RENDER_URL = process.env.RENDER_URL || 'your-app.onrender.com';
const HEALTH_ENDPOINT = `https://${RENDER_URL}/health`;

async function checkHealth() {
  console.log('🔍 Checking bot health...\n');

  try {
    const response = await fetch(HEALTH_ENDPOINT);
    const data = await response.json();

    if (response.ok && data.status === 'ok') {
      console.log('✅ Bot is healthy!');
      console.log(`   Service: ${data.service}`);
      console.log(`   Uptime: ${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m`);
      console.log(`   Last check: ${data.timestamp}`);
      
      // Check if uptime is very low (might indicate recent restarts)
      if (data.uptime < 300) { // Less than 5 minutes
        console.log('⚠️  Warning: Low uptime detected. Service may have restarted recently.');
        console.log('   This could indicate session expiration or other issues.');
      }
      
    } else {
      throw new Error(`Health check failed: ${data.message || 'Unknown error'}`);
    }

  } catch (error) {
    console.log('❌ Bot health check failed!');
    console.log(`   Error: ${error.message}`);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check if your Render service is running');
    console.log('   2. Verify WWEBJS_AUTH environment variable is set');
    console.log('   3. Check Render logs for authentication errors');
    console.log('   4. If session expired, run: npm run reauth');
    
    process.exit(1);
  }
}

// Check local session file if running locally
function checkLocalSession() {
  const sessionPath = '.wwebjs_auth/session';
  
  if (fs.existsSync(sessionPath)) {
    const stats = fs.statSync(sessionPath);
    const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    
    console.log(`📁 Local session last modified: ${Math.floor(daysSinceModified)} days ago`);
    
    if (daysSinceModified > 30) {
      console.log('⚠️  Warning: Local session is quite old and may expire soon.');
      console.log('   Consider running: npm run reauth');
    }
  } else {
    console.log('📁 No local session found. Run: npm run setup');
  }
}

async function main() {
  console.log('🤖 WhatsApp German Bot Health Monitor');
  console.log('====================================\n');

  // Check local session
  checkLocalSession();
  console.log();

  // Check remote health if URL provided
  if (RENDER_URL && RENDER_URL !== 'your-app.onrender.com') {
    await checkHealth();
  } else {
    console.log('💡 Set RENDER_URL environment variable to check remote health');
    console.log('   Example: RENDER_URL=mybot.onrender.com npm run check');
  }
}

main().catch(console.error);