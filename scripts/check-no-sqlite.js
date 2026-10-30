#!/usr/bin/env node
/**
 * Assert that sqlite / sqlite3 are not installed (CVE-2026-119373 family).
 * Those packages were leftover after the PostgreSQL migration and are unused.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKAGES = ['sqlite3', 'sqlite'];

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function collectInstalled(name, node, found) {
  if (!node || typeof node !== 'object') {
    return found;
  }
  if (node.dependencies && node.dependencies[name]) {
    const meta = node.dependencies[name];
    found.push(`${name}@${meta.version || '?'}`);
    collectInstalled(name, meta, found);
  }
  if (node.dependencies) {
    for (const [depName, dep] of Object.entries(node.dependencies)) {
      if (depName !== name) {
        collectInstalled(name, dep, found);
      }
    }
  }
  return found;
}

const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  const deps = pkgJson[section] || {};
  for (const name of PACKAGES) {
    if (Object.prototype.hasOwnProperty.call(deps, name)) {
      fail(`${section} still declares ${name}`);
    }
  }
}

for (const name of PACKAGES) {
  const dir = path.join(ROOT, 'node_modules', name);
  if (fs.existsSync(dir)) {
    fail(`node_modules/${name} exists`);
  }
}

const addon = path.join(ROOT, 'node_modules', 'sqlite3', 'build', 'Release', 'node_sqlite3.node');
if (fs.existsSync(addon)) {
  fail(`SQLite native binary is present at ${path.relative(ROOT, addon)}`);
}

const result = spawnSync('npm', ['ls', ...PACKAGES, '--all', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
});

let tree = {};
try {
  tree = JSON.parse(result.stdout || '{}');
} catch (err) {
  fail(`could not parse npm ls JSON: ${err.message}`);
}

for (const name of PACKAGES) {
  const found = collectInstalled(name, tree, []);
  if (found.length > 0) {
    fail(`npm ls ${name} is not empty: ${found.join(', ')}`);
  }
}

process.stdout.write('npm ls sqlite3 sqlite: empty (not installed)\n');
process.stdout.write('No SQLite native binary is shipped.\n');
