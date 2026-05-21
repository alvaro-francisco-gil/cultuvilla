#!/usr/bin/env node

const pkg = require('../package.json');

const scripts = Object.keys(pkg.scripts);
const has = name => Object.prototype.hasOwnProperty.call(pkg.scripts, name);
const byPrefix = prefix => scripts.filter(s => s.startsWith(prefix)).sort();
const print = name => console.log(`  pnpm ${name}`);
const printAll = list => {
  if (list.length === 0) {
    console.log('  (none yet)');
    return;
  }
  list.forEach(print);
};

console.log('\n🏡 Cultuvilla Monorepo - Available Commands\n');

console.log('\n🌐 Web App (cultuvilla-web):\n');
printAll(byPrefix('web:'));

console.log('\n📱 Mobile App (cultuvilla-mobile):\n');
printAll(byPrefix('app:'));

console.log('\n📦 Shared Package (@cultuvilla/shared):\n');
printAll(byPrefix('shared:'));

console.log('\n☁️  Cloud Functions:\n');
printAll(byPrefix('functions:'));

console.log('\n🌍 i18n Package (@cultuvilla/i18n):\n');
printAll(byPrefix('i18n:'));

console.log('\n🔧 Workspace-wide:\n');
['lint', 'typecheck', 'build', 'test', 'check']
  .filter(has)
  .forEach(print);

console.log('\n🧪 Emulator-backed Tests:\n');
printAll(byPrefix('test:'));

console.log('\n🌱 Seed / Data:\n');
printAll(byPrefix('seed:'));

console.log('\n🚀 Firebase Deployment:\n');
printAll(byPrefix('deploy:'));

console.log('\n❓ Help:\n');
console.log('  pnpm help\n');
