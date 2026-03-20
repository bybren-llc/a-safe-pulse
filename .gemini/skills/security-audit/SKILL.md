---
name: security-audit
description: Data isolation validation, security audits, OWASP compliance, and vulnerability scanning. Use when validating query safety, auditing Express API routes, scanning for security issues, or reviewing code for vulnerabilities.
---

# Security Audit Skill

## Purpose

Guide security validation with data isolation enforcement, OWASP compliance, and vulnerability detection following security-first architecture.

## When This Skill Applies

- Validating data isolation and query safety
- Auditing Express API routes for auth
- Vulnerability scanning
- Pre-deployment security review
- Checking for exposed credentials
- Reviewing database access patterns

## Stop-the-Line Conditions

### FORBIDDEN Patterns

```typescript
// FORBIDDEN: SQL injection via string interpolation
const result = await query(`SELECT * FROM users WHERE id = '${userId}'`);
// Must use: parameterized queries with $1, $2, etc.

// FORBIDDEN: Missing authentication on protected routes
router.get('/api/data', async (req, res) => {
  return res.json(await getAllData()); // No auth check!
});

// FORBIDDEN: Exposed credentials
const API_KEY = "sk_live_abc123"; // Hardcoded secret

// FORBIDDEN: Unscoped queries
const result = await query('SELECT * FROM linear_tokens');
```

### CORRECT Patterns

```typescript
// CORRECT: Parameterized queries
const result = await query(
  'SELECT * FROM users WHERE org_id = $1',
  [orgId]
);

// CORRECT: Auth check before data access
router.get('/api/data', async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json(await getUserData(req.session.userId));
});

// CORRECT: Environment variables for secrets
const API_KEY = process.env.API_SECRET_KEY;
```

## Security Audit Checklist

### 1. Query Safety Validation

- [ ] All database operations use parameterized queries
- [ ] No string-interpolated SQL in route handlers
- [ ] Data isolation verified (org A cannot see org B's data)

```bash
# Find potential SQL injection vulnerabilities
grep -rn '\${' --include="*.ts" src/ | grep -i 'query\|sql'
```

### 2. Authentication Checks

- [ ] All protected routes verify authentication (OAuth session)
- [ ] Proper 401/403 responses for unauthorized

### 3. Credential Scanning

- [ ] No hardcoded secrets in code
- [ ] Environment variables used correctly

```bash
grep -rE "(sk_live|pk_live|password|secret|key)" --include="*.ts" src/ | grep -v "process.env\|.env"
```

### 4. Dependency Vulnerabilities

```bash
npm audit
npm audit --audit-level=high
```

### 5. Input Validation

- [ ] User input validated with Zod schemas
- [ ] No raw query interpolation
- [ ] Webhook signatures verified (HMAC-SHA256)

## OWASP Top 10 Checklist

| Risk                 | Check                              | Status |
| -------------------- | ---------------------------------- | ------ |
| A01 Broken Access    | Data isolation, auth on all routes | ☐      |
| A02 Crypto Failures  | Secrets in env vars only           | ☐      |
| A03 Injection        | Parameterized queries, Zod         | ☐      |
| A04 Insecure Design  | Auth-first pattern followed        | ☐      |
| A05 Misconfiguration | Prod env properly secured          | ☐      |
| A06 Vulnerable Deps  | npm audit clean                    | ☐      |
| A07 Auth Failures    | OAuth integration correct          | ☐      |
| A08 Data Integrity   | Data isolation prevents tampering  | ☐      |
| A09 Logging Failures | Security events logged             | ☐      |
| A10 SSRF             | External URLs validated            | ☐      |

## Security Validation Commands

```bash
# Complete security check
npm audit && npm run lint && echo "Security checks passed"

# SQL injection detection
grep -rn '\${' --include="*.ts" src/ | grep -i 'query\|sql'

# Secret detection
git secrets --scan
grep -rE "sk_|pk_|password=" . --include="*.ts"
```

## Pre-Deployment Security Review

Before ANY production deployment:

- [ ] npm audit shows no high/critical issues
- [ ] Data isolation validated
- [ ] No unparameterized queries
- [ ] Environment variables documented
- [ ] Backup taken before migration
- [ ] Rollback plan documented

## Reference

- **Security Architecture**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
- **DB Connection**: `src/db/connection.ts`
- **OWASP Top 10**: <https://owasp.org/Top10/>
