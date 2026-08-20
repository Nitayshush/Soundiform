/**
 * @file        audit.ts
 * @description ⭐ כתיבה ל-audit_log — חובה לכל פעולת אדמין (§8 "רשימת חובה"). ראה schema/auditLog.ts.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

import { getDb } from './client';
import { auditLog } from './schema';

export interface AuditLogEntry {
  actorId: string;
  action: string;
  target: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  await getDb()
    .insert(auditLog)
    .values({
      actorId: entry.actorId,
      action: entry.action,
      target: entry.target,
      ...(entry.metadata !== undefined && { metadata: entry.metadata }),
      ...(entry.ip !== undefined && { ip: entry.ip }),
    });
}
