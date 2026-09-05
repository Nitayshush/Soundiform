/**
 * @file        page.tsx
 * @description ⭐ דף הבית — עמוד השיווק הראשי. עיצוב מלא (§0.1 עדכון עיצוב, 2026-08-20).
 * @author      Soundiform
 * @created     2026-08-16
 *
 * ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1
 *
 * ⭐ 2026-09-06 (דווח חי: "קשה לראות את הקישור ל-Kids Studio, בנייד הוא נעלם לתוך ההמבורגר"):
 * כפתור-הכניסה ל-Kids Studio בהדר (Header.tsx) נשאר — זה לא מחליף אותו, זה מוסיף דרך
 * הרבה יותר בולטת: כפתור עיצוב-ילדים ממש ליד "Start creating", לא Button המשותף (עיצוב
 * מבוגרים אחיד) אלא עיצוב עצמאי צבעוני-בכוונה (gradient, פונט עגול, אימוג'י) — כדי שיהיה
 * **ברור מיד במבט ראשון** שזו כניסה שונה, לא עוד וריאציה של אותו כפתור.
 */

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const STEPS = [
  {
    title: 'Draw or upload',
    description: 'Sketch a shape on the canvas, or upload an SVG, PNG, JPEG, or logo.',
  },
  {
    title: 'Pick a style',
    description: 'The geometry of your shape drives the melody — the style drives the sound.',
  },
  {
    title: 'Hear it, share it',
    description: 'Every shape has exactly one sound. Save it, remix it, share it with the world.',
  },
];

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
        >
          <div className="h-[36rem] w-[36rem] rounded-full bg-primary/25" />
        </div>

        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-28 text-center">
          <span className="rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-sm text-muted-foreground">
            Every shape has exactly one sound
          </span>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Turn any shape into <span className="text-primary">music</span>
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted-foreground">
            Draw a line, upload a logo — Soundiform maps its geometry to a real, in-key melody. No
            music theory required, always deterministic, always yours.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/studio" />}>
              Start creating
            </Button>
            <Link
              href="/studio/kids"
              className="flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 px-5 text-base font-bold text-white shadow-lg shadow-pink-500/30 transition-transform hover:scale-105 active:scale-95 sm:h-11 sm:text-lg"
            >
              <span aria-hidden="true">🎨</span> Kids Studio
            </Link>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/gallery" />}
            >
              See the gallery
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-28 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="border-border/60">
              <CardHeader>
                <span className="text-sm font-medium text-primary">0{index + 1}</span>
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{step.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </>
  );
}
