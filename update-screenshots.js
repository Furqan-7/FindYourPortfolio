/**
 * Incremental Screenshot Refresh & Update Script
 *
 * Checks portfolios.json for any portfolio URLs that do not currently have a
 * pre-generated preview screenshot in ./previews/ and generates only the missing ones.
 */

const { execSync } = require('child_process');

console.log('🔄 Checking for missing portfolio screenshots...');
try {
  execSync('node generate-screenshots.js', { stdio: 'inherit' });
} catch (err) {
  console.error('Error during screenshot update:', err.message);
  process.exit(1);
}
