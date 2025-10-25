#!/usr/bin/env node

console.log('=== Railway Build Debug Script ===');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Working directory:', process.cwd());

const fs = require('fs');
const path = require('path');

// Check if source files exist and show their imports
const srcDir = './src';
function checkImports(dir, prefix = '') {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      console.log(`${prefix}📁 ${item}/`);
      checkImports(fullPath, prefix + '  ');
    } else if (item.endsWith('.ts')) {
      console.log(`${prefix}📄 ${item}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      const imports = content.match(/import.*from\s+['"][^'"]+['"]/g) || [];
      imports.forEach(imp => {
        if (imp.includes('./') || imp.includes('../')) {
          console.log(`${prefix}  → ${imp}`);
        }
      });
    }
  });
}

console.log('\n=== Source Files and Internal Imports ===');
checkImports(srcDir);

console.log('\n=== TypeScript Config ===');
const tsconfig = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf8'));
console.log('Module:', tsconfig.compilerOptions.module);
console.log('ModuleResolution:', tsconfig.compilerOptions.moduleResolution);
console.log('Target:', tsconfig.compilerOptions.target);

console.log('\n=== Running TypeScript Build ===');
const { execSync } = require('child_process');

try {
  const output = execSync('npx tsc --version', { encoding: 'utf8' });
  console.log('TypeScript version:', output.trim());
  
  console.log('Running build...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.log('❌ Build failed:', error.message);
  console.log('Status:', error.status);
  if (error.stdout) console.log('STDOUT:', error.stdout);
  if (error.stderr) console.log('STDERR:', error.stderr);
}