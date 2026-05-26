# LoKohot — Football team balancer

אפליקציה לניהול רשימת שחקנים, בדיקת נוכחות לערב משחק, ואיזון לשלוש קבוצות (כחול / צהוב / כתום) לפי דירוג כוח 1–6.

בנוי כמו [eurovision-hit-or-script](https://github.com/mikizi/eurovision-hit-or-script): **Vite + TypeScript** ב-GitHub Pages, נתונים ב-**Supabase** (PostgREST מהדפדפן, בלי חבילת `@supabase/js`).

## תכונות

- חיפוש שחקן מהרשימה והוספה ל"מגיעים הערב"
- שחקן חדש + דירוג כוח
- עריכת כוח (1 = הכי חזק)
- איזון אוטומטי ואיזון מחדש
- גרירה בין עמודות הקבוצות
- שמירה ב-Supabase

## הגדרת Supabase (פעם אחת)

אפשר להשתמש באותו פרויקט Supabase כמו `eurovision-hit-or-script`, או ליצור חדש.

1. ב-SQL Editor הרץ את [`supabase/schema.sql`](supabase/schema.sql)  
   **או** מהטרמינל (צריך סיסמת DB מ-Settings → Database):

```sh
SUPABASE_DB_PASSWORD='your-db-password' npm run db:apply
```

2. העתק `.env.example` → `.env` עם:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (מ-Project Settings → API)

## פיתוח מקומי

```sh
cp .env.example .env
# ערוך .env עם ה-URL וה-anon key

npm ci
npm run dev
```

פתח http://localhost:5173

## בדיקות

```sh
npm test
```

## פריסה ל-GitHub Pages

1. דחוף ל-`main`.
2. ב-GitHub → Settings → Pages → Source: **GitHub Actions**.
3. הוסף Secrets ל-repo:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

(אותו דפוס כמו ב-eurovision-hit-or-script.)

## מבנה

```text
src/
  main.ts           # אתחול
  lokohotDb.ts      # PostgREST
  balance.ts        # אלגוריתם איזון
  ui/               # check-in, teams
supabase/schema.sql # טבלאות + seed + RLS
```

## דירוג כוח

- 1 = הכי חזק, 6 = הכי חלש
- מותר עשרוני (2.5, 3.5)
- לאיזון צריך מספר שחקנים שמתחלק ב-3
