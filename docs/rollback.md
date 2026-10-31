# Rollback

How to put back the last working version when a deploy breaks the app. Written for the founder; each step names where to click.

Status: **not yet tested**. The launch checklist asks for one real rollback, timed and written down. Do that once, on staging when it exists, and note the date here.

## Frontend (Vercel)

Vercel builds the frontend from `main`. Every earlier build is kept.

1. Open the project on Vercel, then **Deployments**.
2. Find the last build that worked. Its commit message is the clue.
3. Open its menu (the three dots) and choose **Instant Rollback**. If the menu has no such item, choose **Promote to Production** on that build instead. The labels change between Vercel releases, so check the menu once and update this step.
4. Open `app.sentriahq.dev` in a private window and sign in. The dashboard should load and the Robo button should show.

Rollback changes what visitors get straight away. It does not change the code. The broken commit is still on `main`, so the next push to `main` brings it back.

To fix the code as well, revert the bad commit on `main` (`git revert <sha>`). That needs the founder's yes, because it is a push to `main`.

## Backend (Render)

The API is the `Sentria` repo, deployed on Render from `main`.

1. Open the API service on Render, then **Events** or **Deploys**.
2. Pick the last deploy that worked and use its **Rollback** action (or redeploy that commit).
3. Check `/health` answers `200`.

Database migrations are numbered files in `migrations/` and are written to be safe to re-run. Rolling back the app does not undo a migration. If a migration is the cause, the fix is a new numbered migration that puts the table back. Do not delete rows or drop columns in a hurry.

## Before a risky deploy

- Note the commit that works now.
- Check `/health` and sign in once after the deploy.
- If something breaks, roll back first and fix second.
