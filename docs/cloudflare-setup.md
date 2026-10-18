# Cloudflare in front of the API (S-7): setup checklist

Scope: the API only (the FastAPI service). The frontend stays on Vercel, which already has its own edge.

The API side is built and does nothing until you set `ORIGIN_SECRET`. It works the same on any host, so moving away from Render later changes one DNS record and nothing else.

Plan limits and menu names change. Check them on the Cloudflare site as you go. Anything marked UNVERIFIED is from memory.

## What you need
1. A domain you own, for example `sentria.app`. Cloudflare cannot sit in front of `onrender.com` itself.
2. A free Cloudflare account.

## Steps, in this order
The order matters. Setting the secret on the API before Cloudflare sends it locks everyone out.

**1. Put the domain on Cloudflare**
1. Add the site, pick the Free plan, and change the name servers at your registrar to the two Cloudflare gives you.

**2. Point an API name at your host**
1. DNS, add a `CNAME`: name `api`, target is your current API host name (today the `onrender.com` name). Turn the orange cloud ON (Proxied).
2. On the host (Render), add `api.yourdomain` as a custom domain so it accepts that name.
3. SSL/TLS: set the mode to **Full (strict)**. Turn on **Always Use HTTPS**.

**3. Make Cloudflare send the secret**
1. Make a long random value. Keep it in your password manager. Never in the repo.
2. Rules, Transform Rules, Modify Request Header, new rule:
   - When: hostname equals `api.yourdomain`
   - Then: Set static, header `X-Origin-Secret`, value = your secret.

**4. Point the app at the new name**
1. On Vercel set `NEXT_PUBLIC_API_URL` to `https://api.yourdomain` and redeploy.
2. Add the new API name to `EXTRA_CORS_ORIGINS` only if the frontend also moves to a new domain. The API's own name is not a browser origin.
3. Open the app. Sign in. Upload a file. All should work as before.

**5. Turn the lock on**
1. On the host set `ORIGIN_SECRET` to the same value. Redeploy.
2. Test: open the old `onrender.com` address in a browser, on a path like `/plans`. You must see `origin_blocked` (403). `/health` still answers, on purpose, for the host's health check.
3. Test the app again through `api.yourdomain`.
4. If the app breaks, remove `ORIGIN_SECRET` on the host. The API is open again.

**6. Rate limits at the edge**
Rules, Rate limiting rules. Suggested starting values. Tune them after a week of real traffic.

| Match (path) | Limit per IP | Action |
|---|---|---|
| `/auth/username-sign-in` | 10 per minute | Block for 10 minutes |
| `/upload` | 20 per minute | Block for 1 minute |
| `/ask` | 20 per minute | Block for 1 minute |
| everything else | 300 per minute | Block for 1 minute |

The Free plan may allow only one rate limit rule and short time windows. UNVERIFIED. If so, start with the sign-in rule. The API has its own limits as well (sign-in, uploads, Ask, SMS), so Cloudflare is a second wall.

**7. Firewall and bots**
1. Security, WAF: turn on the free managed rules if the plan offers them (UNVERIFIED which ones).
2. Security, Bots: turn on Bot Fight Mode.
3. Do not add a challenge on `/sms/inbound`. Twilio calls it and cannot solve a challenge.

**8. Watch it**
1. Security, Events: look at it once a week for blocked traffic and false blocks.
2. Notifications: turn on an alert for a traffic spike (UNVERIFIED on the Free plan).

## What the API does for you (already built)
1. With `ORIGIN_SECRET` set, any request without the right `X-Origin-Secret` gets 403 `origin_blocked`, except `/health`.
2. With the lock on, the caller's address for rate limits is Cloudflare's `CF-Connecting-IP`. Without the lock it is never trusted, so nobody can fake it.
3. Every answer carries `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`. In production it also sends HSTS.
4. The frontend carries the same headers (plus a Permissions-Policy that turns off camera, microphone and location).

## Not covered
1. Cloudflare is never a replacement for the API's own sign-in and company checks.
2. No Content-Security-Policy yet. It needs its own pass because of inline styles and the Vercel Analytics script.
3. Checking the origin by Cloudflare IP ranges is not used. The secret header works on every host. Add IP ranges later only if the new host has a firewall for it.

## When you move host
1. Change the `api` CNAME target to the new host name. Add `api.yourdomain` as a custom domain there.
2. Set the same `ORIGIN_SECRET` on the new host.
3. Nothing changes in the app, in Cloudflare rules or in Vercel.
