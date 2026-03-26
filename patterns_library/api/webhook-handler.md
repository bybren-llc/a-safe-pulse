# Webhook Handler Pattern

## What It Does

Creates a secure Express webhook endpoint for processing external service events. Validates signatures using HMAC-SHA256 with timing-safe comparison, processes events by type, and updates the database with parameterized SQL. Modeled after the actual Linear webhook handler in `src/webhooks/`.

## When to Use

- Linear webhook event processing
- Third-party service notifications (Confluence, Slack, etc.)
- Asynchronous event processing
- System-level data updates from external services

## Code Pattern

```typescript
// src/webhooks/{service}-handler.ts
import crypto from 'crypto';
import { Request, Response } from 'express';
import { Pool } from 'pg';
import * as logger from '../utils/logger';

/**
 * Verifies the webhook signature using HMAC-SHA256.
 *
 * Reference implementation: src/webhooks/verification.ts
 *
 * @param signature - The signature from the request header (e.g., Linear-Signature)
 * @param body      - The raw request body
 * @returns boolean indicating if the signature is valid
 */
function verifyWebhookSignature(signature: string, body: any): boolean {
  if (!signature) {
    return false;
  }

  const webhookSecret = process.env.{SERVICE}_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('{SERVICE}_WEBHOOK_SECRET environment variable is not set');
    return false;
  }

  try {
    // Extract timestamp and signature from the header
    // Format: "t=<timestamp>,v1=<signature>"
    const [timestamp, signatureHash] = signature.split(',');

    if (!timestamp || !signatureHash) {
      return false;
    }

    const timestampValue = timestamp.split('=')[1];
    const signatureValue = signatureHash.split('=')[1];

    if (!timestampValue || !signatureValue) {
      return false;
    }

    // Check if the timestamp is recent (within 5 minutes)
    const timestampDate = new Date(parseInt(timestampValue) * 1000);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (timestampDate < fiveMinutesAgo) {
      logger.error('Webhook timestamp is too old');
      return false;
    }

    // Create the signature payload
    const payload = `${timestampValue}.${JSON.stringify(body)}`;

    // Calculate the expected signature using HMAC-SHA256
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signatureValue),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * POST /webhook/{service} - Process webhook events
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // 1. Verify webhook signature
    const signature = req.headers['{signature-header}'] as string;

    const isValid = verifyWebhookSignature(signature, req.body);

    if (!isValid) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Extract event data
    const { type, action, data } = req.body;
    logger.info(`Received webhook: ${type} - ${action}`, { type, action });

    // 3. Process event based on type
    switch (type) {
      case '{event.type.created}':
        await handleCreatedEvent(req, data);
        break;

      case '{event.type.updated}':
        await handleUpdatedEvent(req, data);
        break;

      case '{event.type.deleted}':
        await handleDeletedEvent(req, data);
        break;

      default:
        logger.info(`Unhandled webhook type: ${type}`, { type, action });
    }

    // 4. Success response
    return res.status(200).json({
      received: true,
      event_type: type,
    });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle created event
 */
async function handleCreatedEvent(req: Request, data: any): Promise<void> {
  const pool: Pool = req.app.get('db');

  // Upsert record with parameterized SQL
  await pool.query(
    `INSERT INTO {table_name} (external_id, status, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (external_id)
     DO UPDATE SET status = $2, metadata = $3, updated_at = NOW()`,
    [data.id, data.status, JSON.stringify(data.metadata || {})]
  );

  // Optional: Log webhook event for audit
  await pool.query(
    `INSERT INTO webhook_events (event_type, event_id, service, processed, processed_at, event_data)
     VALUES ($1, $2, $3, true, NOW(), $4)`,
    [data.type, data.id, '{service}', JSON.stringify(data)]
  );
}

/**
 * Handle updated event
 */
async function handleUpdatedEvent(req: Request, data: any): Promise<void> {
  const pool: Pool = req.app.get('db');

  await pool.query(
    `UPDATE {table_name}
     SET status = $1, updated_at = NOW()
     WHERE external_id = $2`,
    [data.status, data.id]
  );
}

/**
 * Handle deleted event
 */
async function handleDeletedEvent(req: Request, data: any): Promise<void> {
  const pool: Pool = req.app.get('db');

  await pool.query(
    `UPDATE {table_name}
     SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
     WHERE external_id = $1`,
    [data.id]
  );
}
```

### Registering the Webhook Route

```typescript
// src/index.ts (or src/routes/index.ts)
import express from 'express';
import { handleWebhook } from './webhooks/{service}-handler';

const app = express();

// IMPORTANT: webhook routes need raw body for signature verification
// If using express.json() globally, add raw body parsing middleware:
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.post('/webhook/{service}', handleWebhook);
```

## Customization Guide

1. **Replace placeholders**:
   - `{service}` -- Service name (e.g., `linear`, `confluence`)
   - `{SERVICE}` -- Uppercase for env vars (e.g., `LINEAR`, `CONFLUENCE`)
   - `{signature-header}` -- Header name (e.g., `linear-signature`)
   - `{table_name}` -- PostgreSQL table name
   - `{event.type.*}` -- Event type strings for your service

2. **Update event handlers**:
   - Add event types you need to handle
   - Implement business logic for each event
   - Handle related data updates

3. **Add error recovery**:
   - Implement retry logic if needed
   - Log failures for manual intervention
   - Send alerts for critical failures (see `OperationalNotificationCoordinator`)

4. **Security considerations**:
   - Always verify signatures with HMAC-SHA256
   - Use timing-safe comparison (`crypto.timingSafeEqual`)
   - Validate timestamp freshness (5-minute window)
   - Log all webhook events for audit

## Security Checklist

- [x] **Signature Verification**: HMAC-SHA256 with timing-safe comparison
- [x] **Timestamp Validation**: Reject events older than 5 minutes
- [x] **Env Validation**: Check webhook secret exists before verifying
- [x] **Parameterized SQL**: No string concatenation in queries
- [x] **Error Logging**: Log failures with context
- [x] **Audit Trail**: Store webhook events in database
- [x] **Idempotency**: Use `ON CONFLICT` / upsert to handle duplicate events

## Validation Commands

```bash
# Type checking
npm run build

# Run tests
npm test

# Full validation
npm test && npm run build && echo "BE SUCCESS" || echo "BE FAILED"
```

## Example: Linear Webhook Handler

This example mirrors the actual implementation in `src/webhooks/handler.ts`:

```typescript
// src/webhooks/handler.ts (actual codebase reference)
import { Request, Response } from 'express';
import { verifyWebhookSignature } from './verification';
import * as logger from '../utils/logger';

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // Verify the webhook signature
    const isValid = verifyWebhookSignature(
      req.headers['linear-signature'] as string,
      req.body
    );

    if (!isValid) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, action } = req.body;
    logger.info(`Received webhook: ${type} - ${action}`, { type, action });

    switch (type) {
      case 'AppUserNotification':
        await processAppUserNotification(req.body);
        break;

      case 'Issue':
      case 'Comment':
      case 'IssueLabel':
        await processIssueEvent(req.body);
        break;

      default:
        logger.info(`Unhandled webhook type: ${type}`, { type, action });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

## Related Patterns

- [User Context API](./user-context-api.md) - For user operations
- [Admin Context API](./admin-context-api.md) - For admin operations
- [API Integration Test](../testing/api-integration-test.md) - Testing webhooks

---

**Pattern Source**: `src/webhooks/handler.ts`, `src/webhooks/verification.ts`
**Last Updated**: 2026-03
**Validated By**: System Architect
