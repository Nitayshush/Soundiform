import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // חבילות ה-workspace נשלחות כ-TS גולמי (בלי build step) — צריך טרנספילציה על ידי Next.js.
  transpilePackages: [
    '@shape-sound/core',
    '@shape-sound/audio',
    '@shape-sound/genres',
    '@shape-sound/storage',
    '@shape-sound/shared',
    '@shape-sound/ui',
  ],
  // paper.js מזהה סביבת Node (כולל ב-SSR של קומפוננטות client) ומנסה לטעון שכבת חיקוי
  // מבוססת jsdom שלא מותקנת אצלנו בכוונה — אנחנו משתמשים בו רק למתמטיקה וקטורית בדפדפן.
  // tone/pixi.js נוספו מראש (Sprint 4) מאותה סיבה עקרונית — ספריות Web Audio/WebGL שלא
  // אמורות להיבנות עבור ה-SSR target כלל; שתיהן נטענות רק דרך import() דינמי בתוך useEffect.
  // bullmq/ioredis (Sprint 6): שרת-בלבד (api/render/route.ts), עם dynamic requires פנימיים —
  // לא אמורות לעבור דרך bundler הצד-לקוח כלל.
  // @shape-sound/db/postgres (Sprint 7): postgres.js משתמש ב-node:net/node:tls ישירות —
  // בלי זה Turbopack קורס (panic) בניסיון לבנות chunk לקוח שמגיע ל-@shape-sound/db, גם
  // כשהאימפורט בפועל הוא רק ב-Server Components/Route Handlers (account/page.tsx, api/*).
  serverExternalPackages: [
    'paper',
    'tone',
    'pixi.js',
    'bullmq',
    'ioredis',
    '@shape-sound/db',
    'postgres',
  ],
};

export default nextConfig;
