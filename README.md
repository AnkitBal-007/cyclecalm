# CycleCalm — Period, Ovulation & PMS Calendar

CycleCalm is a fully static, client-side web app that helps you track your menstrual cycle. Enter the first day of your last period, your average cycle length, and your typical period duration; the app projects six future cycles onto a monthly calendar, highlighting:

- **Period days** (rose-pink ◆)
- **Fertile window** (sage teal ◇), with **peak days** (deep teal ★●) flagged as the best days for conception
- **PMS window** (amber ▲)

An info panel beside the calendar repeats the same information in plain language (next period date, ovulation date, fertile window range, peak days, PMS window). All data is stored exclusively in your own browser via `localStorage` — nothing is ever sent to a server. A "Clear saved data" button wipes everything instantly.

---

## Project structure

```
index.html          ← page skeleton, links CSS + JS
css/
  styles.css        ← all styles (reset, form, calendar, info panel)
js/
  cycle-calculator.js  ← pure date-math, no DOM access
  calendar.js          ← calendar grid + info panel renderer
  app.js               ← form wiring, validation, localStorage
README.md
.gitignore
```

## Running locally

No build step needed. Just open `index.html` directly in any modern browser:

```
# Option A — file:// protocol (simplest)
Double-click index.html in Explorer

# Option B — local server (avoids any file:// quirks)
npx serve .        # or: python -m http.server 8080
```

---

## Deploying to Vercel (free Hobby plan)

This is a zero-config static site. Vercel will serve `index.html` automatically with no build step.

### One-time setup

1. **Push to GitHub.**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Connect to Vercel.**
   - Go to [vercel.com](https://vercel.com) and sign in (GitHub login works).
   - Click **Add New Project → Import** and select your GitHub repository.
   - Under **Framework Preset**, choose **Other**.
   - Leave **Build Command** and **Output Directory** completely blank.
   - Click **Deploy**.

3. **Done.** Vercel assigns a `*.vercel.app` URL immediately.

### Auto-deploy on every push

After the first deployment, every `git push` to your default branch (`main`) automatically triggers a new Vercel deployment — no extra configuration required.

> **Note:** No `vercel.json` is needed. Because this is a single-page static site with no serverless functions, no environment variables, and no framework, Vercel's defaults work perfectly.

---

## Disclaimer

These are calendar-based estimates only and are **not medical advice**. This app is **not a reliable method of contraception**. Please consult a healthcare professional for medical guidance.
