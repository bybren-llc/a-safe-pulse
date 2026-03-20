---
name: security-audit
description: RLS validation, security audits, OWASP compliance, and vulnerability scanning. Use when validating data isolation, auditing Express API routes, or scanning for security issues.
context: fork
agent: Explore
allowed-tools: Read, Bash, Grep, Glob
---

# Security Audit Skill

## Purpose

Guide security validation with data isolation enforcement, OWASP compliance, and vulnerability detection following security-first architecture.

## When This Skill Applies

Invoke this skill when:

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
  // No auth check before accessing user data
  return res.json(await getAllData());
});

// FORBIDDEN: Exposed credentials
const API_KEY = "sk_live_abc123"; // Hardcoded secret

// FORBIDDEN: Unscoped queries exposing all rows
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

// CORRECT: Scoped queries with org isolation
const result = await query(
  'SELECT * FROM linear_tokens WHERE organization_id = $1',
  [orgId]
);
```

## Security Audit Checklist

### 1. Query Safety Validation

- [ ] All database operations use parameterized queries ($1, $2, etc.)
- [ ] No string-interpolated SQL in route handlers
- [ ] Data isolation verified (org A cannot see org B's data)
- [ ] All queries scoped by organization_id or session_id

```bash
# Find potential SQL injection vulnerabilities
grep -rn '\${' --include="*.ts" src/ | grep -i 'query\|sql' | grep -v '\$1\|\$2\|\$3'
```

### 2. Authentication Checks

- [ ] All protected routes verify authentication (OAuth session)
- [ ] OAuth session verified before data access
- [ ] Proper 401/403 responses for unauthorized

```bash
# Find Express route handlers
grep -rn "router\.\(get\|post\|put\|delete\)" --include="*.ts" src/ | head -20
# Manually verify each has auth check
```

### 3. Credential Scanning

- [ ] No hardcoded secrets in code
- [ ] No API keys in source files
- [ ] Environment variables used correctly

```bash
# Scan for potential secrets
grep -rE "(sk_live|pk_live|password|secret|key)" --include="*.ts" src/ | grep -v "process.env\|.env\|\.template"
```

### 4. Dependency Vulnerabilities

```bash
# Run security audit
npm audit

# Check for high/critical vulnerabilities
npm audit --audit-level=high
```

### 5. Input Validation

- [ ] User input validated with Zod schemas
- [ ] No raw query string interpolation
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

# SQL injection vulnerability detection
grep -rn '\${' --include="*.ts" src/ | grep -i 'query\|sql'

# Secret detection
git secrets --scan  # If git-secrets installed
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

## Security Audit Report Template

```markdown
## Security Audit Report - ASP-XXX

### Summary

- **Date**: [date]
- **Auditor**: Security Engineer
- **Scope**: [what was audited]

### Findings

| Severity | Issue | Location | Status |
| -------- | ----- | -------- | ------ |
| HIGH     | ...   | ...      | FIXED  |
| MEDIUM   | ...   | ...      | OPEN   |

### Data Isolation Validation

- [x] All queries use parameterized SQL
- [x] Organization isolation verified
- [x] Webhook signatures verified

### Recommendations

1. [recommendation]
2. [recommendation]

### Approval

- [ ] Security Engineer approves
- [ ] Ready for deployment
```

## Authoritative References

- **Security Architecture**: `docs/guides/SECURITY_FIRST_ARCHITECTURE.md`
- **DB Connection**: `src/db/connection.ts` (parameterized query interface)
- **Webhook Handler**: `src/webhooks/handler.ts` (HMAC-SHA256 verification)
- **OWASP Top 10**: <https://owasp.org/Top10/>
