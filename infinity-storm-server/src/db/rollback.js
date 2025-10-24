#!/usr/bin/env node
/**
 * Quick rollback: restore from a JSON dump (export.js)
 */
require('dotenv').config();
const { execSync } = require('child_process');

const dump = process.argv[2];
if (!dump) {
  console.error('Usage: rollback.js <dump.json>');
  process.exit(1);
}

try {
  execSync('node src/db/migrate.js down', { stdio: 'inherit' });
  execSync('node src/db/migrate.js up',   { stdio: 'inherit' });
  execSync(`node src/db/import.js ${dump}`, { stdio: 'inherit' });
  console.log('[rollback] complete');
} catch (e) {
  console.error('[rollback] failed:', e.message);
  process.exit(1);
}








