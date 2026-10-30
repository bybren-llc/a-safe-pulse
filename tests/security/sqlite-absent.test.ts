/**
 * sqlite / sqlite3 must not ship. They were unused leftovers after the
 * PostgreSQL migration and bundle SQLite < 3.54.0 (CVE-2026-119373 family).
 */
import * as fs from 'fs';
import * as path from 'path';

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
});
