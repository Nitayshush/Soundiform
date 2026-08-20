/**
 * @file        Logo.tsx
 * @description ⭐ סימן המותג — משולש מתאר + 3 עמודות עולות (כמו equalizer) + wordmark
 *              "sound" (foreground) + "iform" (primary/accent). ראה docs/DECISIONS.md.
 * @author      Soundiform
 * @created     2026-08-20
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ ה-wordmark הוא טקסט DOM אמיתי (לא SVG <text>) — נגישות/render חד יותר; רק הסימן
 * הגרפי (משולש+עמודות) הוא SVG. משתמש ב-currentColor/fill-primary כך שהוא עוקב אחרי
 * טוקני העיצוב ב-globals.css אוטומטית, בלי צבעים מקודדים-קשיח.
 */

import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 3 L1.5 28.5 L26.5 28.5 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect x="21" y="19" width="4" height="9.5" rx="1.6" className="fill-primary" />
      <rect x="28" y="12" width="4" height="16.5" rx="1.6" className="fill-primary" />
      <rect x="35" y="6" width="4" height="22.5" rx="1.6" className="fill-primary opacity-80" />
    </svg>
  );
}

export interface LogoProps {
  className?: string;
  iconClassName?: string;
  /** רק הסימן הגרפי, בלי ה-wordmark — ל-favicon/מקומות צפופים. */
  markOnly?: boolean;
}

export function Logo({ className, iconClassName, markOnly = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      <LogoMark className={cn('h-6 w-auto', iconClassName)} />
      {!markOnly && (
        <span className="text-lg font-semibold tracking-tight">
          sound<span className="text-primary">iform</span>
        </span>
      )}
    </span>
  );
}
