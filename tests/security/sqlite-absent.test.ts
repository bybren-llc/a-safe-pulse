/**
 * sqlite / sqlite3 must not ship. They were unused leftovers after the
 * PostgreSQL migration and bundle SQLite < 3.54.0 (CVE-2026-119373 family).
 */
import * as fs from 'fs';
import * as path from 'path';

const {
  findSqliteInTree,
  isSqliteAliasSpec,
  isSqliteIdentity,
  validateNpmLsResult,
} = require('../../scripts/check-no-sqlite');

const ROOT = path.join(__dirname, '../..');

describe('sqlite packages are not shipped', () => {
  it('does not resolve the sqlite3 module', () => {
    expect(() => require.resolve('sqlite3')).toThrow(/Cannot find module/);
  });

  it('does not resolve the sqlite module', () => {
    expect(() => require.resolve('sqlite')).toThrow(/Cannot find module/);
  });

  it('does not install node_modules/sqlite3 or its native addon', () => {
    expect(fs.existsSync(path.join(ROOT, 'node_modules', 'sqlite3'))).toBe(false);
    expect(
      fs.existsSync(
        path.join(ROOT, 'node_modules', 'sqlite3', 'build', 'Release', 'node_sqlite3.node')
      )
    ).toBe(false);
  });

  it('does not install node_modules/sqlite', () => {
    expect(fs.existsSync(path.join(ROOT, 'node_modules', 'sqlite'))).toBe(false);
  });

  it('detects sqlite3 installed under an npm alias in the ls tree', () => {
    expect(isSqliteAliasSpec('npm:sqlite3@6.0.1')).toBe(true);
    expect(isSqliteAliasSpec('npm:sqlite@5.1.1')).toBe(true);
    expect(isSqliteAliasSpec('^6.0.1')).toBe(false);
    expect(
      isSqliteIdentity('driver', {
        name: 'sqlite3',
        version: '6.0.1',
        resolved: 'https://registry.npmjs.org/sqlite3/-/sqlite3-6.0.1.tgz',
      })
    ).toBe(true);

    const found = findSqliteInTree(
      {
        dependencies: {
          driver: {
            name: 'sqlite3',
            version: '6.0.1',
            resolved: 'https://registry.npmjs.org/sqlite3/-/sqlite3-6.0.1.tgz',
          },
        },
      },
      []
    );
    expect(found.join(' ')).toMatch(/driver \(sqlite3@6\.0\.1\)/);
  });

  it('fails closed on npm ls top-level error JSON with exit 1', () => {
    expect(() =>
      validateNpmLsResult({
        status: 1,
        stdout: '{"error":{"code":"EFAKE"}}',
      })
    ).toThrow(/npm ls reported an error: EFAKE/);
  });

  it('fails closed on empty npm ls JSON with exit 1', () => {
    expect(() =>
      validateNpmLsResult({
        status: 1,
        stdout: '{}',
      })
    ).toThrow(/without an inspectable dependency tree/);
  });

  it('accepts a full tree when npm ls exits nonzero for ELSPROBLEMS', () => {
    const tree = {
      name: 'a-safe-pulse',
      version: '0.1.0',
      dependencies: {
        express: { version: '4.21.2' },
      },
      error: { code: 'ELSPROBLEMS', summary: 'extraneous: leftover@1.0.0' },
    };
    expect(
      validateNpmLsResult({
        status: 1,
        stdout: JSON.stringify(tree),
      })
    ).toEqual(tree);
  });
});
