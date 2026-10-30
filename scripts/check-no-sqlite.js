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

function isSqlitePackageName(name) {
  return PACKAGES.includes(name);
}

function isSqliteResolved(resolved) {
  const value = String(resolved || '');
  // registry.npmjs.org/sqlite3/-/sqlite3-6.0.1.tgz  (check sqlite3 first)
  if (value.includes('/sqlite3/-/')) {
    return true;
  }
  // registry.npmjs.org/sqlite/-/sqlite-5.1.1.tgz — do not match sqlite3
  return /\/sqlite\/-\/sqlite-/.test(value);
}

function isSqliteAliasSpec(spec) {
  if (typeof spec !== 'string') {
    return false;
  }
  return /^(npm:)?sqlite3(@|$)/.test(spec) || /^(npm:)?sqlite(@|$)/.test(spec);
}

function isSqliteIdentity(key, meta) {
  const name = (meta && meta.name) || key;
  const resolved = meta && meta.resolved;
  return isSqlitePackageName(key) || isSqlitePackageName(name) || isSqliteResolved(resolved);
}

/**
 * Walk a full `npm ls --json` tree and collect sqlite identities, including
 * packages installed under an npm alias (folder name != package name).
 */
function findSqliteInTree(node, found) {
  if (!node || typeof node !== 'object') {
    return found;
  }
  const deps = node.dependencies || {};
  for (const [key, meta] of Object.entries(deps)) {
    if (!meta || typeof meta !== 'object') {
      continue;
    }
    if (isSqliteIdentity(key, meta)) {
      const name = meta.name || key;
      found.push(`${key} (${name}@${meta.version || '?'})`);
    }
    findSqliteInTree(meta, found);
  }
  return found;
}

function hasInspectableTree(tree) {
  return (
    !!tree &&
    typeof tree === 'object' &&
    !Array.isArray(tree) &&
    typeof tree.dependencies === 'object' &&
    tree.dependencies !== null &&
    typeof tree.name === 'string' &&
    tree.name.length > 0 &&
    typeof tree.version === 'string' &&
    tree.version.length > 0
  );
}

/**
 * Validate a spawnSync-like npm ls result. Throws on fail-closed cases so
 * tests can inject stdout/status without spawning.
 */
function validateNpmLsResult(result) {
  if (result.error) {
    throw new Error(`failed to run npm ls: ${result.error.message}`);
  }
  if (!result.stdout || !String(result.stdout).trim()) {
    throw new Error('npm ls produced no output');
  }

  let tree;
  try {
    tree = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`could not parse npm ls JSON: ${err.message}`);
  }

  const inspectable = hasInspectableTree(tree);
  if (tree && typeof tree === 'object' && tree.error && !inspectable) {
    const code =
      tree.error && typeof tree.error === 'object' && tree.error.code
        ? tree.error.code
        : 'unknown';
    throw new Error(`npm ls reported an error: ${code}`);
  }
  if (result.status !== 0 && result.status !== null && !inspectable) {
    throw new Error(
      `npm ls exited ${result.status} without an inspectable dependency tree`
    );
  }

  return tree;
}

function runNpmLsJson() {
  const args = ['ls', '--all', '--json'];
  const npmExecPath = process.env.npm_execpath;
  let result;
  if (npmExecPath) {
    result = spawnSync(process.execPath, [npmExecPath, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } else {
    const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    result = spawnSync(cmd, args, {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
  }

  try {
    return validateNpmLsResult(result);
  } catch (err) {
    fail(err.message);
  }
  return {};
}

function walkNodeModules(dir, onPkg) {
  if (!fs.existsSync(dir)) {
    return;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    fail(`could not read ${path.relative(ROOT, dir)}: ${err.message}`);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue;
    }
    if (entry.name === '.bin' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('@')) {
      walkNodeModules(full, onPkg);
      continue;
    }
    const pkgFile = path.join(full, 'package.json');
    if (fs.existsSync(pkgFile)) {
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      } catch (err) {
        fail(`could not parse ${path.relative(ROOT, pkgFile)}: ${err.message}`);
      }
      onPkg(full, pkg);
      walkNodeModules(path.join(full, 'node_modules'), onPkg);
    }
  }
}

function checkManifest() {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const deps = pkgJson[section] || {};
    for (const [name, spec] of Object.entries(deps)) {
      if (isSqlitePackageName(name) || isSqliteAliasSpec(spec)) {
        fail(`${section} still declares ${name}: ${spec}`);
      }
    }
  }
}

function checkLockfile() {
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    return;
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  for (const [pkgPath, meta] of Object.entries(lock.packages || {})) {
    if (!pkgPath || !meta || typeof meta !== 'object') {
      continue;
    }
    const folderName = pkgPath.split('node_modules/').pop();
    if (isSqliteIdentity(folderName, meta)) {
      fail(`package-lock.json still contains ${pkgPath}`);
    }
  }
}

function checkInstalledTree() {
  walkNodeModules(path.join(ROOT, 'node_modules'), (dir, pkg) => {
    if (isSqlitePackageName(pkg.name)) {
      fail(`found ${pkg.name}@${pkg.version || '?'} at ${path.relative(ROOT, dir)}`);
    }
    const addon = path.join(dir, 'build', 'Release', 'node_sqlite3.node');
    if (fs.existsSync(addon)) {
      fail(`SQLite native binary is present at ${path.relative(ROOT, addon)}`);
    }
  });
}

function checkNpmLs() {
  const tree = runNpmLsJson();
  const found = findSqliteInTree(tree, []);
  if (found.length > 0) {
    fail(`npm ls tree still contains sqlite: ${found.join(', ')}`);
  }
}

function main() {
  checkManifest();
  checkLockfile();
  checkInstalledTree();
  checkNpmLs();

  process.stdout.write('npm ls sqlite3 sqlite: empty (not installed)\n');
  process.stdout.write('No SQLite native binary is shipped.\n');
}

module.exports = {
  PACKAGES,
  findSqliteInTree,
  hasInspectableTree,
  isSqliteAliasSpec,
  isSqliteIdentity,
  isSqlitePackageName,
  isSqliteResolved,
  validateNpmLsResult,
};

if (require.main === module) {
  main();
}
