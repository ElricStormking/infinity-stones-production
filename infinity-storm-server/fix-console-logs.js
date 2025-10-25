/**
 * Automated Console Log Fixer
 * 
 * This script helps automate the replacement of console.log/error/warn
 * statements with winston logger in production code.
 * 
 * Usage: node fix-console-logs.js <file-path>
 */

const fs = require('fs');
const path = require('path');

function fixConsoleStatements(filePath) {
  console.log(`\nProcessing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let changes = 0;
  
  // Check if logger is already imported
  const hasLoggerImport = content.includes('require(\'../utils/logger\')') || 
                          content.includes('require("../utils/logger")');
  
  if (!hasLoggerImport) {
    // Find the last require statement
    const requireRegex = /^const .* = require\(['"]([@\w\-\.\/]+)['"]\);?$/gm;
    const matches = [...content.matchAll(requireRegex)];
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const lastRequireEnd = lastMatch.index + lastMatch[0].length;
      
      // Determine correct path depth
      const depth = (filePath.match(/\//g) || []).length - 2; // -2 for src/ base
      const loggerPath = '../'.repeat(depth) + 'utils/logger';
      
      // Insert logger import after last require
      content = content.slice(0, lastRequireEnd) + 
                `\nconst { logger } = require('${loggerPath}');` +
                content.slice(lastRequireEnd);
      changes++;
      console.log(`  ✓ Added logger import`);
    }
  }
  
  // Replace console.log statements
  const replacements = [
    // console.log with string interpolation
    {
      pattern: /console\.log\(`([^`]+)`\);?/g,
      replace: (match, msg) => {
        // Check if message contains variables (${...})
        if (msg.includes('${')) {
          return `logger.info(\`${msg}\`);`;
        }
        return `logger.info('${msg.replace(/'/g, "\\'")}');`;
      }
    },
    // console.log with regular strings
    {
      pattern: /console\.log\('([^']+)'\);?/g,
      replace: (match, msg) => `logger.info('${msg}');`
    },
    {
      pattern: /console\.log\("([^"]+)"\);?/g,
      replace: (match, msg) => `logger.info("${msg}");`
    },
    // console.error
    {
      pattern: /console\.error\('([^']+)',\s*([^)]+)\);?/g,
      replace: (match, msg, args) => {
        // Try to parse the args as an object
        if (args.includes('error.message') || args.includes('.message')) {
          const varName = args.split('.')[0].trim();
          return `logger.error('${msg}', { error: ${varName}.message });`;
        }
        return `logger.error('${msg}', { details: ${args} });`;
      }
    },
    {
      pattern: /console\.error\(`([^`]+)`\);?/g,
      replace: (match, msg) => `logger.error(\`${msg}\`);`
    },
    // console.warn
    {
      pattern: /console\.warn\('([^']+)'\);?/g,
      replace: (match, msg) => `logger.warn('${msg}');`
    },
    {
      pattern: /console\.warn\(`([^`]+)`\);?/g,
      replace: (match, msg) => `logger.warn(\`${msg}\`);`
    }
  ];
  
  replacements.forEach(({ pattern, replace }) => {
    const newContent = content.replace(pattern, replace);
    if (newContent !== content) {
      const count = (content.match(pattern) || []).length;
      changes += count;
      content = newContent;
      console.log(`  ✓ Replaced ${count} console statement(s)`);
    }
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Fixed ${changes} issues in ${path.basename(filePath)}`);
    return changes;
  } else {
    console.log(`  ℹ️  No changes needed`);
    return 0;
  }
}

// Process files
const filesToFix = [
  'src/config/redis.js',
  'src/config/featureFlags.js',
  'src/game/gameEngine.js',
  'src/game/stateManager.js',
  'src/routes/api.js',
  'src/routes/admin.js',
  'src/services/metricsService.js',
  'src/services/CascadeSynchronizer.js'
];

if (process.argv[2]) {
  // Single file mode
  const totalChanges = fixConsoleStatements(process.argv[2]);
  console.log(`\n✨ Total changes: ${totalChanges}`);
} else {
  // Batch mode
  console.log('🔧 Batch fixing console statements in critical files...\n');
  let totalChanges = 0;
  
  filesToFix.forEach(file => {
    try {
      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        totalChanges += fixConsoleStatements(fullPath);
      } else {
        console.log(`  ⚠️  File not found: ${file}`);
      }
    } catch (error) {
      console.log(`  ❌ Error processing ${file}: ${error.message}`);
    }
  });
  
  console.log(`\n✨ Total changes across all files: ${totalChanges}`);
  console.log('\n📋 Next steps:');
  console.log('  1. Review changes: git diff');
  console.log('  2. Run lint: npm run lint');
  console.log('  3. Run tests: npm test');
}
