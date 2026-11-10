# Tarlac Gospel of Grace Church — website

Preaching Archives, announcements, events, photo gallery, the King James Bible, QR code sharing and “What's new” notifications.

**How it fits together**

| Part | What it does | Cost |
|---|---|---|
| **GitHub** | Keeps the website's files | Free |
| **Netlify** | Puts the website online at an address like `https://tggc.netlify.app` | Free plan |
| **Supabase** | Stores what the pastor posts (preachings, announcements, events, photos, audio) and handles his login | Free plan |

Visitors don't need any account. Only the pastor and helpers log in, to post.

Setting everything up takes about 30–45 minutes, once. After that, the pastor posts from the website itself and nothing here needs touching.

---

## Step 1 — Create the database (Supabase)

1. Go to **https://supabase.com** and click **Start your project**. Sign up (signing in with GitHub is easiest).
2. Click **New project**.
   - **Name:** `tggc-website`
   - **Database password:** click *Generate a password* and save it somewhere safe (you rarely need it).
   - **Region:** *Southeast Asia (Singapore)*, the closest to Tarlac, so the site loads faster.
   - **Plan:** Free.
3. Click **Create new project** and wait a minute or two until it's ready.

## Step 2 — Set up the church's tables and security

1. On your computer, open the file **`supabase/setup.sql`** in a text editor (TextEdit on Mac, Notepad on Windows).
2. Near the bottom, find `pastor@example.com` and replace it with **the pastor's real email address**. Keep the quote marks around it.
3. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
4. Copy everything in `setup.sql`, paste it into the editor, and click **Run**.
   You should see *“Success. No rows returned.”*

This creates the tables, the security rules (everyone can read; only the pastor can post), live updates, the storage space for photos and audio, and the welcome announcement.

## Step 3 — Create the pastor's login

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
2. Enter the **same email** you put in `setup.sql`, choose a password, and tick **Auto Confirm User**. Click **Create user**.
3. Go to **Authentication → Sign In / Providers** (on some versions: *Authentication → Settings*) and turn **off** “Allow new users to sign up”. Click **Save**.
   This stops strangers from creating accounts. Even if someone did, they couldn't post, because only emails on the editor list can.

## Step 4 — Connect the website to the database

1. In Supabase, go to **Project Settings → API Keys** (on some versions: *Project Settings → API*).
2. Copy two values:
   - the **Project URL** (looks like `https://abcdefghijkl.supabase.co`; also shown under *Data API*), and
   - the **anon public** key (a long code starting with `eyJ`, sometimes under *Legacy API keys*), **or** the **publishable** key (starts with `sb_publishable_`).
3. Open **`config.js`** in a text editor and paste them between the quote marks:

   ```js
   SUPABASE_URL: "https://abcdefghijkl.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi....",
   ```
4. Save the file.

> These two values are meant to be public. The security rules from Step 2 are what protect the church's content. **Never** put the *service_role* or *secret* key in this file.

## Step 5 — Put the files on GitHub

1. Go to **https://github.com** and sign in (or create a free account).
2. Click **+** (top right) → **New repository**.
   - **Repository name:** `tggc-website`
   - Choose **Public** or **Private** (either works with Netlify).
   - Click **Create repository**.
3. On the new, empty repository page, click the link **“uploading an existing file”**.
4. Open the website folder on your computer. **On a Mac, press `Cmd + Shift + .` in Finder** so the hidden `.github` folder shows too.
5. Select **everything inside the folder** (all files *and* folders, including `.github`) and drag it onto the GitHub page. Wait for the uploads to finish.
6. Click **Commit changes**.

## Step 6 — Put the website online (Netlify)

1. Go to **https://app.netlify.com** and sign up **with GitHub**.
2. Click **Add new project → Import an existing project → GitHub**. Allow Netlify to see your repositories if it asks.
3. Choose **`tggc-website`**.
4. Leave **Build command** empty and **Publish directory** as it is (the included `netlify.toml` already sets it). Click **Deploy**.
5. After about a minute your site is live at a random address. To choose a nicer one:
   **Project configuration → Change project name** → type `tggc` (or `tarlacgospelofgrace`) → **Save**.
   Your address becomes `https://tggc.netlify.app` (if that name is free).

## Step 7 — Tell Supabase your web address

In Supabase, go to **Authentication → URL Configuration**, set **Site URL** to your Netlify address (for example `https://tggc.netlify.app`) and click **Save**.
This makes the “Forgot password?” emails send the pastor back to the right website.

## Step 8 — Log in and try it

1. Open your site and add `#login` to the address, for example **`https://tggc.netlify.app/#login`**. Bookmark this for the pastor.
   (There's also a **Pastor login** link at the bottom of every page.)
2. Log in with the pastor's email and password. The **Pastor's Desk** opens.
3. Post a test announcement, then open the site on your phone: it should be there, with no sign-in.
4. Click **Share** at the top to download the **printable QR card**. It now points to your Netlify address.

## Step 9 — Keep the database awake (check once)

Supabase pauses free databases that go 7 days without any visits. The included job visits it twice a week so that never happens.

1. On GitHub, open your repository → **Actions** tab. If asked, click **I understand my workflows, go ahead and enable them**.
2. Click **Keep church database awake → Run workflow**. After a few seconds you should see a green check mark.

**Don't see “Keep church database awake” in the Actions tab?** The hidden `.github` folder didn't get uploaded. Add it on GitHub directly:
1. In your repository, click **Add file → Create new file**.
2. In the name box, type exactly: `.github/workflows/keep-database-awake.yml` (typing the `/` creates the folders).
3. Paste the text from **Appendix A** at the bottom of this guide, then click **Commit changes**.

GitHub turns scheduled jobs off if a repository has no changes for 60 days. If you get an email from GitHub about it, just click the link in it to turn the job back on.

---

## Everyday use

- **Posting** (preachings, announcements, events, photos, verse of the week, church details) is done by the pastor on the website, in **Pastor's Desk**. Posts appear for everyone right away. Nothing on GitHub or Netlify needs to change.
- **Adding a helper** (secretary, media team):
  1. Supabase → **Authentication → Users → Add user** (their email + a password, tick *Auto Confirm User*).
  2. Supabase → **SQL Editor**, run: `insert into public.editors (email) values ('helper@example.com');`
- **Removing a helper:** run `delete from public.editors where email = 'helper@example.com';`
- **Changing the website's design or built-in photos:** edit or upload the file on GitHub and click **Commit changes**. Netlify republishes the site automatically within a minute or two.

## Limits on the free plans

- **Netlify:** 300 credits a month. Each republish of the design costs 15, and visitors' downloads cost 20 per GB. That covers thousands of visits a month for a site like this. Posting content doesn't use credits.
- **Supabase:**
  - 1 GB of file storage, and each file can be up to 50 MB.
  - 5 GB a month of files downloaded by visitors.
  - Sermon audio is the biggest use of both. For full-length recordings, it's often better to upload them to YouTube or Facebook and paste the link in the preaching's *Video link* field.
- If you ever outgrow a free plan, both services offer paid plans, and nothing in the website needs to change.

## If something isn't working

- **A yellow bar says “Setup isn't finished”:** `config.js` still has the example values. Redo Step 4, then upload the updated `config.js` to GitHub (Step 5, steps 3–6).
- **A yellow bar says “The church database can't be reached”:** the Supabase project may be paused. Open the Supabase dashboard and click **Restore project**, then check Step 9.
- **Login says the account “isn't on the church's editor list”:** the email in the `editors` table must match the login email. Re-run the insert from *Adding a helper*.
- **An upload fails:** the file is probably larger than 50 MB.

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole website |
| `config.js` | Your Supabase address and key (Step 4) |
| `js/backend.js` | Connects the website to Supabase |
| `js/supabase.js`, `js/qrcode.js` | Libraries the website uses (MIT licensed) |
| `kjv.json`, `kjv.js` | The King James Bible (public domain) |
| `logo.png`, `photos/` | Church logo and photos |
| `supabase/setup.sql` | Database setup (Step 2) |
| `netlify.toml` | Netlify settings |
| `.github/workflows/keep-database-awake.yml` | Keeps the free database from pausing (Step 9) |

---

## Appendix A — keep-database-awake.yml

```yaml
# Supabase pauses free projects after 7 days without any activity.
# This job visits the church database twice a week so it never falls asleep.
# It needs no setup: it reads the address and public key from config.js.

name: Keep church database awake

on:
  schedule:
    - cron: "17 2 * * 1,4"   # Mondays and Thursdays, 10:17 AM Philippine time
  workflow_dispatch: {}      # also lets you run it by hand from the Actions tab

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Visit the database
        run: |
          node -e '
            global.window = {};
            require("./config.js");
            const c = window.TGGC_CONFIG || {};
            if (!c.SUPABASE_URL || /YOUR-/.test(c.SUPABASE_URL + c.SUPABASE_ANON_KEY)) {
              console.log("config.js is not filled in yet; nothing to do.");
              process.exit(0);
            }
            const url = c.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/docs?select=path&limit=1";
            fetch(url, { headers: { apikey: c.SUPABASE_ANON_KEY, Authorization: "Bearer " + c.SUPABASE_ANON_KEY } })
              .then(r => { console.log("Database answered with status", r.status); if (!r.ok) process.exit(1); })
              .catch(e => { console.error(e); process.exit(1); });
          '
```
