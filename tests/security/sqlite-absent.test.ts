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
});
