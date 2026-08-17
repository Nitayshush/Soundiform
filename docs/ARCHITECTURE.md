# ARCHITECTURE.md

> טיוטה — ייכתב מפורט יותר ככל שהמימוש יתקדם. הבסיס הארכיטקטוני המחייב מתועד ב-[`PROJECT.md`](PROJECT.md) §3–§4.

## מצב

Sprint 0 — שלד המונוריפו נוצר. אין עדיין מימוש של מנוע ההמרה.

## עקרונות מחייבים (ראה PROJECT.md §3)

1. `core`, `audio`, `genres` הם חסיני-סביבה — אין בהם `window`, `document`, `fs`, `process`.
2. תלות זורמת בכיוון אחד בלבד: `apps → packages`, `core → shared`, `audio → core, shared`.
