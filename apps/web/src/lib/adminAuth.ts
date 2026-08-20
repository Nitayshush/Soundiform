/**
 * @file        adminAuth.ts
 * @description ⭐ הרשאות אדמין — רשימת אימיילים מקודדת ב-ADMIN_EMAILS (§11 Sprint 9, הוחלט
 *              דרך AskUserQuestion: "רשימת אימיילים מקודדת" ולא עמודת is_admin ב-DB).
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️ בדיקת ההרשאה מבוססת על session מאומת אמיתי (supabase.auth.getUser(), מאומת מול השרת —
 * לא getSession() שרק קורא cookie בלי אימות) + האימייל שלו מול allowlist בצד-שרת. לעולם לא
 * לסמוך על טענה מהקליינט (§0.3).
 */

import { createClient } from './supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

/** מחזיר את המשתמש המחובר אם הוא אדמין (לפי ADMIN_EMAILS), אחרת null. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return null;
  }
  if (!getAdminEmails().has(user.email.toLowerCase())) {
    return null;
  }
  return { id: user.id, email: user.email };
}
