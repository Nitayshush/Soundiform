/**
 * @file        StorageProvider.ts
 * @description ⭐ ההפשטה שמאחורי כל אחסון קבצים בפרויקט. גישה לאחסון מותרת רק דרך הממשק הזה
 *              (PROJECT.md §7 "כללי מימוש" — גישה רק דרך packages/storage, לעולם לא ישירות).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 */

export interface UploadUrlOptions {
  /** ברירת מחדל: 900 (15 דקות) — לפי §7 "העלאות: presigned URLs, תוקף 15 דקות" */
  expiresInSeconds?: number;
  contentType?: string;
}

export interface DownloadUrlOptions {
  expiresInSeconds?: number;
  /**
   * ⭐ 2026-08-22: ערך Content-Disposition (למשל 'attachment; filename="soundiform.mp4"') —
   * בלעדיו הדפדפן פשוט מנווט ל-URL החתום (מנגן/מציג את הקובץ inline) במקום להוריד אותו
   * בפועל לדיסק. נתפס ע"י בדיקה חיה: כפתור ה-Download החדש היה "עוזב" את האתר לגמרי,
   * לא שומר קובץ. ראה api/renders/[renderId]/download/route.ts.
   */
  responseContentDisposition?: string;
}

export interface ObjectMetadata {
  sizeBytes: number;
  contentType?: string;
}

/**
 * הפשטת אחסון קבצים. מימוש פעיל: R2Provider. מימוש גיבוי: SupabaseProvider.
 * ⚠️ קבצים פרטיים תמיד דרך signed URLs — אף פעם לא bucket ציבורי (§7).
 */
export interface StorageProvider {
  readonly id: string;

  /** URL חתום להעלאה ישירה (PUT) למפתח נתון. */
  getUploadUrl(key: string, options?: UploadUrlOptions): Promise<string>;

  /** URL חתום להורדה/צפייה של קובץ פרטי. */
  getDownloadUrl(key: string, options?: DownloadUrlOptions): Promise<string>;

  /** מחיקה פיזית של אובייקט. נקרא רק מ-cron אחרי soft delete + 30 יום (§7). */
  deleteObject(key: string): Promise<void>;

  /** בדיקת קיום/מטא-דאטה בלי להוריד את התוכן. מחזיר null אם לא קיים. */
  headObject(key: string): Promise<ObjectMetadata | null>;
}
