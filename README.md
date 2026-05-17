# 📅 Familiekalender — Setup Guide

A simple shared family calendar for Mom and Dad.

---

## 📁 Files

```
familycal/
├── index.html      ← The app
├── style.css       ← All styling
├── app.js          ← All logic
├── supabase.js     ← Database connection
├── manifest.json   ← Makes it installable on Android
└── sw.js           ← Offline support
```

---

## 🧪 How to test locally (on your computer)

You need a simple local server. Here are two easy options:

### Option A — VS Code (recommended)
1. Install the **"Live Server"** extension in VS Code
2. Right-click `index.html` → **"Open with Live Server"**
3. The app opens in your browser at `http://127.0.0.1:5500`

### Option B — Python (if installed)
```bash
cd familycal
python3 -m http.server 8000
```
Then open: `http://localhost:8000`

> ⚠️ Do NOT just double-click `index.html` — some features won't work without a server.

---

## 🚀 Deploy to Netlify (free)

1. Go to [github.com](https://github.com) and create a new repository called `familycal`
2. Upload all the files in this folder to that repository
3. Go to [netlify.com](https://netlify.com) and sign up (free)
4. Click **"Add new site" → "Import an existing project"**
5. Connect your GitHub account → choose the `familycal` repo
6. Leave all settings as default → click **"Deploy site"**
7. Your app will be live in ~60 seconds at a URL like `https://amazing-name-123.netlify.app`
8. You can set a custom name under **Site settings → Change site name**

---

## 🗄️ Connect Supabase (shared database — do this after testing locally)

1. Go to [supabase.com](https://supabase.com) → Sign up → **New project**
2. Give it a name (e.g. `familycal`) and a password (save it somewhere!)
3. Wait ~2 minutes for it to set up
4. In the left sidebar, click **"SQL Editor"**
5. Paste and run this SQL to create the events table:

```sql
create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date date not null,
  time time,
  who text not null check (who in ('mom','dad','both')),
  note text,
  created_at timestamp with time zone default now()
);

-- Allow all access (for family use only — no login needed)
alter table events enable row level security;
create policy "Family can do everything" on events
  for all using (true) with check (true);
```

6. Go to **Project Settings → API** (left sidebar)
7. Copy **"Project URL"** and **"anon public" key**
8. Open `supabase.js` and paste them:

```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_KEY = 'your-anon-key-here';
```

9. Save the file, push to GitHub → Netlify auto-deploys!

---

## 📱 Install on Android (add to home screen)

1. Open the Netlify URL in **Chrome on Android**
2. Tap the **three dots menu (⋮)** in the top right
3. Tap **"Add to Home screen"**
4. Tap **"Install"**
5. The app now appears on the home screen like a real app!

---

## 🎨 Colors (if you want to change them)

All colors are in `style.css` at the top:

```css
--accent: #4a7c6f;   /* Main green — buttons etc. */
--mom:    #c97b84;   /* Dusty rose — Mom's events */
--dad:    #6b8fb5;   /* Dusty blue — Dad's events */
--both:   #8a7fc0;   /* Soft purple — Both */
```
