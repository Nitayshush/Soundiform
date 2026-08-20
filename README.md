# Soundiform

פלטפורמה שהופכת צורות גאומטריות, ציורים ולוגואים למוזיקה מקצועית.

📖 מסמך האב של הפרויקט: [`docs/PROJECT.md`](docs/PROJECT.md) — חובה לקרוא במלואו לפני כתיבת קוד.

## פיתוח

דרישות מקדימות: Node 22+, pnpm 9+, Git, ffmpeg מותקן מקומית.

```bash
pnpm install
pnpm dev        # apps/web
```

## מבנה

- `apps/web` — Next.js, הממשק
- `apps/worker` — Fastify, רנדור אודיו/וידאו
- `packages/core` — מנוע ההמרה (צורה → מוזיקה)
- `packages/audio` — מקור הצליל + מיקס
- `packages/genres` — Genre Packs (נתונים)
- `packages/storage` — הפשטת אחסון (R2)
- `packages/db` — סכימה ומיגרציות (Drizzle)
- `packages/shared` — טיפוסים וקבועים משותפים
- `packages/ui` — קומפוננטות משותפות
