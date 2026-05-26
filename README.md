# LoKohot — Football team balancer

אפליקציה לניהול רשימת שחקנים, בדיקת נוכחות לערב משחק, ואיזון לשלוש קבוצות (ירוק / צהוב / כתום) לפי דירוג כוח 1–6.

בנוי כמו [eurovision-hit-or-script](https://github.com/mikizi/eurovision-hit-or-script): **Vite + TypeScript** ב-GitHub Pages, נתונים ב-**Supabase** (PostgREST מהדפדפן, בלי חבילת `@supabase/js`).

## תכונות

- חיפוש שחקן מהרשימה והוספה ל"מגיעים הערב"
- שחקן חדש + דירוג כוח
- עריכת כוח (1 = הכי חזק)
- איזון אוטומטי ואיזון מחדש
- גרירה בין עמודות הקבוצות
- שמירה ב-Supabase

## הגדרת Supabase

אפשר להשתמש באותו פרויקט Supabase כמו `eurovision-hit-or-script`.

### איפוס מלא (מומלץ — מוחק הכל ובונה מחדש)

Supabase → **SQL Editor** → הדבק והרץ את כל הקובץ:

**[`supabase/reset_all.sql`](supabase/reset_all.sql)**

זה מוחק את כל הטבלאות, יוצר אותן מחדש, 42 שחקנים בלי כפילויות, וסיסמת ניהול `hagigat1234`.

בסוף תראה שורת סיכום: `players | 42`.

### הגדרה ראשונה (בלי מחיקה)

רק אם המסד ריק: [`supabase/schema.sql`](supabase/schema.sql) + [`migration_game.sql`](supabase/migration_game.sql) + [`migration_admin.sql`](supabase/migration_admin.sql).

העתק `.env.example` → `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## דפים

| דף | כתובת | תפקיד |
|----|--------|--------|
| ציבורי | `index.html` | קבוצות, תוצאות משחקים, טבלה, כובשים |
| ניהול | `admin.html` | check-in, איזון, פרסום לציבור |

קוד ניהול (`admin.html`): `hagigat1234` — לשנות: עדכן `admin_pin` בטבלת `app_settings`.

### פרסום ערב

1. ב-**ניהול**: check-in → איזון → **שמור קבוצות** → **פרסם לעמוד הציבורי**
2. ב-**עמוד ציבורי**: עדכון תוצאות (3 משחקים), הוספת כובשים, צפייה בטבלה

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
