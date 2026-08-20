/**
 * @file        page.tsx
 * @description פאנל ניהול — מודרציה, feature flags, GenrePacks, audit_log (§11 Sprint 9).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ Sprint 9: הרשאה נבדקת כאן (Server Component, getAdminUser — ADMIN_EMAILS) ולא רק
 * ב-API routes — כדי שמי שאינו אדמין לא יראה בכלל את מבנה העמוד (§0.3: לא לחשוף מבנה פנימי).
 */

import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/adminAuth';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) {
    redirect('/login?next=/admin');
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-lg font-semibold">ניהול</h1>
      <AdminDashboard />
    </main>
  );
}
