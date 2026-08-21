import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // חבילות ה-workspace נשלחות כ-TS גולמי (בלי build step) — צריך טרנספילציה על ידי Next.js.
  transpilePackages: [
    '@soundiform/core',
    '@soundiform/audio',
    '@soundiform/genres',
    '@soundiform/storage',
    '@soundiform/shared',
    '@soundiform/ui',
  ],
  // tone/pixi.js נוספו מראש (Sprint 4) — ספריות Web Audio/WebGL שלא אמורות להיבנות עבור
  // ה-SSR target כלל; שתיהן נטענות רק דרך import() דינמי בתוך useEffect.
  // bullmq/ioredis (Sprint 6): שרת-בלבד (api/render/route.ts), עם dynamic requires פנימיים —
  // לא אמורות לעבור דרך bundler הצד-לקוח כלל.
  // @soundiform/db/postgres (Sprint 7): postgres.js משתמש ב-node:net/node:tls ישירות —
  // בלי זה Turbopack קורס (panic) בניסיון לבנות chunk לקוח שמגיע ל-@soundiform/db, גם
  // כשהאימפורט בפועל הוא רק ב-Server Components/Route Handlers (account/page.tsx, api/*).
  // sharp/potrace/jsdom (Sprint 9, api/upload): sharp טוען binding נייטיבי, jsdom נוגע ב-fs/
  // node:vm — אותה סיבה עקרונית, גם אם ה-import בפועל הוא רק בתוך apps/web/src/lib/upload/*
  // (route-only, לעולם לא נטען מקומפוננטת קליינט).
  // ⭐ 'paper' הוסר מהרשימה (2026-08-21): useShapeCapture.ts הוחלף מ-paper.js Path.simplify()
  // ל-RDP עצמאי — paper.js כבר לא בשימוש באף מקום בפרויקט.
  serverExternalPackages: [
    'tone',
    'pixi.js',
    'bullmq',
    'ioredis',
    '@soundiform/db',
    'postgres',
    'sharp',
    'potrace',
    'jsdom',
  ],
};

export default nextConfig;
