/**
 * Single source of truth for the backend base URL.
 *
 * This constant used to be declared twice — once in dashboard-view.tsx and
 * once in ask-view.tsx. When the backend moved from Railway to Render only
 * the dashboard copy was updated, so Ask AI went on calling the dead
 * Railway host. The dashboard kept loading alerts and recommendations
 * normally, which is exactly why the failure looked like "the AI is
 * broken" rather than "the chat is pointed at the wrong server".
 *
 * Every view imports this now, so the URL can only ever be wrong in one
 * place. Override per environment with NEXT_PUBLIC_API_URL (useful for
 * pointing the UI at a local backend while debugging).
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://retail-nqu5.onrender.com'
