/**
 * @file        legalPages.ts
 * @description ⭐ 2026-09-06 — ממלא תוכן-פתיחה ל-legal_pages (slug='terms') פעם אחת,
 *              idempotent (`onConflictDoUpdate`), כדי ש-/terms לא יהיה ריק בדיפלוי הראשון.
 *              מריצים דרך `pnpm run db:seed-legal`.
 * @author      Soundiform
 * @created     2026-09-06
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⚠️⚠️ התוכן כאן הוא נוסח-פתיחה סביר (לא ייעוץ משפטי) — מומלץ שעורך-דין יעבור עליו לפני
 * שהוא נשען-עליו-בפועל, בהתחשב בהתחייבויות האמיתיות שכבר תועדו ב-docs/PROJECT.md §"תאימות"
 * (תיקון 13 לחוק הגנת הפרטיות + GDPR). אחרי ה-seed הראשוני, ה-DB הוא מקור האמת (עריכה
 * דרך פאנל האדמין, בלי דיפלוי) — הרצה חוזרת של הסקריפט הזה **דורסת** עריכות אדמין בחזרה
 * לנוסח הזה, בדיוק כמו seedGenrePacks.
 */

import { getDb } from '../client';
import { legalPages } from '../schema';

const TERMS_TITLE = 'Terms of Service';

const TERMS_CONTENT = `Last updated: September 2026

Welcome to Soundiform. By creating an account or using Soundiform, you agree to these Terms of Service.

What Soundiform does: Soundiform turns a drawing, uploaded image, or shape you provide into generated music. The service is offered on a free plan with limited monthly creations and saves, and paid plans with expanded limits, described on our Pricing page.

Your content: You keep ownership of whatever you draw or upload. By saving a creation, you give Soundiform permission to store it and, if you choose to share it, to display it to other users through the public gallery or a share link. You are responsible for what you upload — do not upload content you do not have the right to use, and do not upload content that is illegal, hateful, or infringes on someone else's rights. Uploaded images may be reviewed before or after they appear publicly.

Accounts: You are responsible for keeping your account credentials secure. You must be old enough to legally agree to these terms in your country, or have a parent or guardian's permission to use Soundiform.

Free and paid plans: Free-plan limits (creations per month, saved projects, video length) are described on the Pricing page and may change. Paid plans, once billing is enabled, will be described at the time of purchase.

Acceptable use: Do not use Soundiform to harass others, to upload malicious files, to attempt to access other users' accounts or data, or to abuse the service's infrastructure (for example, automated mass-creation).

Disclaimer: Soundiform is provided "as is." Generated music quality, availability, and export formats may change as the product evolves. We do not guarantee the service will be uninterrupted or error-free.

Changes to these terms: We may update these terms as Soundiform evolves. Continued use of the service after a change means you accept the updated terms.

Contact: If you have questions about these terms, reach out through the contact details on our website.`;

export async function seedLegalPages(): Promise<number> {
  const db = getDb();

  await db
    .insert(legalPages)
    .values({ slug: 'terms', title: TERMS_TITLE, content: TERMS_CONTENT })
    .onConflictDoUpdate({
      target: legalPages.slug,
      set: { title: TERMS_TITLE, content: TERMS_CONTENT, updatedAt: new Date() },
    });

  return 1;
}
