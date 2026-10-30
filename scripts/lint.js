// scripts/lint.js
// Runs syntax and integrity checks across JavaScript source files in the project.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const directories = ['controllers', 'routes', 'middleware', 'lib', 'scripts'];
const individualFiles = ['server.js', 'db.js'];

let checkedCount = 0;
const errors = [];

function checkFile(filePath) {
  try {
    execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
    checkedCount++;
  } catch (err) {
    errors.push(`Syntax error in ${path.relative(rootDir, filePath)}:\n${err.stderr ? err.stderr.toString() : err.message}`);
  }
}

for (const file of individualFiles) {
  const fullPath = path.join(rootDir, file);
  if (fs.existsSync(fullPath)) {
    checkFile(fullPath);
  }
}

for (const dir of directories) {
  const dirPath = path.join(rootDir, dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith('.js') && !file.endsWith('.test.js')) {
        checkFile(path.join(dirPath, file));
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Linting failed with ${errors.length} error(s):`);
  errors.forEach((e) => console.error(e));
  process.exit(1);
}

console.log(`✅ Linting passed: ${checkedCount} JavaScript files verified with valid syntax.`);
process.exit(0);
