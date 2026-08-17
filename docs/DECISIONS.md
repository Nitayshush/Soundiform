# DECISIONS.md — יומן החלטות (ADR)

## 2026-08-16 — Sprint 0: אתחול המונוריפו

- **החלטה:** pnpm workspaces monorepo, TypeScript strict בכל מקום, ESLint flat config (typescript-eslint strictTypeChecked).
- **החלטה:** `apps/web` נוצר עם `create-next-app` (Next.js 16.3.1 — גרסת ה-latest נכון ל-2026-08, לא 15 כפי שהופיע בטיוטה המקורית; PROJECT.md §2 עודכן בהתאם, React 19, App Router, Tailwind v4, src/).
- **החלטה:** `PROJECT.md` הועבר מהשורש ל-`docs/PROJECT.md` לפי המבנה ב-§3.
- **נדחה ל-Sprint מאוחר יותר:** חיבור בפועל ל-Supabase ו-R2 (דורש credentials של בעל הפרויקט).
