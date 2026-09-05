import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import './globals.css';

/**
 * ⭐ 2026-08-27 (לפי בקשה חיה: "בנייד מקוטע, נכבה, רעשי רקע"): AudioContext שנוצר בלי
 * latencyHint מפורש נוטה ל-buffer קטן/"interactive" — נכון לכלי-נגינה חי, לא לפריוויו-לופ
 * ברקע (latency לא משנה שם בכלל; מה שחשוב זה ש-thread האודיו לא "יפספס deadline"=
 * underrun=בדיוק הקליקים/חירחורים שדווחו). "playback" latencyHint מבקש buffer גדול יותר —
 * הרבה יותר מרווח-נשימה, בלי לשנות שום דבר בתוכן/בקוד המוזיקלי.
 *
 * ⚠️ למה Proxy על window.AudioContext כאן (beforeInteractive) ולא Tone.setContext() בתוך
 * packages/audio: כבר ניסינו את זה וזה שבר את הניגון לגמרי (ראה git history) — Tone.js
 * (הגרסה כאן) יוצר Transport/Destination/Listener כ-const ברמת-המודול, מחוברים ל-context
 * שקיים *ברגע import 'tone' הראשון*, לפני שכל קוד שלנו מספיק לרוץ (גם דינמי, כי
 * @soundiform/audio's מודולים מייבאים 'tone' באופן סטטי ברגע שנטענים). setContext אחרי
 * זה משאיר את ה-singletons האלה עם AudioParam-ים שבורים. הפתרון: ליירט את הבנאי-הגלובלי
 * של AudioContext (Proxy) *לפני* שכל JS של הדף בכלל רץ — Script strategy="beforeInteractive"
 * הוא בדיוק המנגנון המתועד של Next.js לזה (כמו polyfill) — כך ש-Tone.js, כשהוא בסוף בונה את
 * ה-context הדיפולטיבי שלו בעצמו, מקבל אוטומטית latencyHint="playback" מבלי שנוגעים ב-Tone
 * בכלל. safe-guard על window.AudioContext קיים (SSR/דפדפנים ישנים) ועל idempotency (לא
 * לעטוף פעמיים אם ה-script הזה איכשהו רץ פעמיים).
 */
const CONFIGURE_AUDIO_CONTEXT_SCRIPT = `
(function () {
  if (typeof window === 'undefined' || !window.AudioContext || window.__sfAudioCtxPatched) {
    return;
  }
  window.__sfAudioCtxPatched = true;
  var Native = window.AudioContext;
  var Patched = new Proxy(Native, {
    construct: function (target, args) {
      var options = args[0] || {};
      var merged = {};
      for (var key in options) { merged[key] = options[key]; }
      merged.latencyHint = 'playback';
      return new target(merged);
    }
  });
  window.AudioContext = Patched;
  if (window.webkitAudioContext) {
    window.webkitAudioContext = Patched;
  }
})();
`;

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Soundiform',
  description: 'Turn geometric shapes, drawings, and logos into professional music.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Script
          id="configure-audio-context"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: CONFIGURE_AUDIO_CONTEXT_SCRIPT }}
        />
        <GoogleAnalytics />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
