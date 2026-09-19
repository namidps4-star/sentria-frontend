/**
 * English.
 *
 * Typed as Record<keyof typeof fr, string>, which is the point: leave a
 * key out and `tsc` fails. There is no way to ship a screen where half
 * the labels fell back to French without the build telling you.
 *
 * Written by hand, not machine-passed. These are operational labels, and
 * "Blocages" is not "Blockages" in a port, it is what stops a container
 * moving. Where the French is product vocabulary the English follows the
 * same register rather than the dictionary.
 */

import type { fr } from "./fr"

export const en: Record<keyof typeof fr, string> = {
  /* ---------------------------------------------------------------- */
  /*  Sidebar                                                          */
  /* ---------------------------------------------------------------- */

  "brand.tagline": "Industrial Intelligence",
  "brand.status.title": "SentrIA active",
  "brand.status.subtitle": "Intelligence online",

  "sidebar.section.operations": "OPERATIONS",
  "sidebar.section.intelligence": "INTELLIGENCE",
  "sidebar.section.studio": "STUDIO",

  "sidebar.close": "Close the sidebar",
  "sidebar.collapse": "Collapse the sidebar",
  "sidebar.expand": "Expand the sidebar",

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  "nav.dashboard": "Dashboard",
  "nav.calendar": "Calendar",
  "nav.sites": "Sites",
  /* Not "Contractors" alone: the list holds anyone who can be sent out,
     staff included. "Field team" says that and stays short in a rail. */
  "nav.contractors": "Field team",
  "nav.ask": "Ask SentrIA",
  "nav.report": "Report",
  "nav.pricing": "Subscription",
  "nav.profile": "Profile",
  "nav.settings": "Settings",

  /* ---------------------------------------------------------------- */
  /*  Top bar                                                          */
  /* ---------------------------------------------------------------- */

  "topbar.menu.open": "Open the menu",
  "topbar.search.placeholder": "Search an asset or an alert…",
  "topbar.search.label": "Search an asset or an alert",
  "topbar.search.clear": "Clear the search",

  "topbar.notifications.none": "Notifications, no critical alert",
  "topbar.notifications.one": "Notifications, 1 critical alert",
  "topbar.notifications.many": "Notifications, {count} critical alerts",

  "topbar.account": "Account",
  "topbar.account.of": "{name} account",

  /* ---------------------------------------------------------------- */
  /*  View titles                                                      */
  /* ---------------------------------------------------------------- */

  "view.dashboard.title": "Dashboard",
  "view.dashboard.subtitle": "Your operations at a glance",

  "view.calendar.title": "Calendar",
  "view.calendar.subtitle": "Upcoming deadlines, critical thresholds and incidents",

  "view.sites.title": "Sites",
  "view.sites.subtitle": "Manage your plants, depots and customers",

  "view.ask.title": "Ask SentrIA",
  "view.ask.subtitle": "Your AI-assisted analyst",

  "view.pricing.title": "Subscription",
  "view.pricing.subtitle": "Pick the plan that fits your operations",

  "view.profile.title": "Profile",
  "view.profile.subtitle": "Your account and your activity",

  "view.settings.title": "Settings",
  "view.settings.subtitle": "Language, notifications and organisation",

  "view.report.title": "Report",
  "view.report.subtitle": "A detailed read on your operations",

  "view.contractors.title": "Field team",
  "view.contractors.subtitle": "Who is available, and who is on what",

  /* ---------------------------------------------------------------- */
  /*  Buttons and states                                               */
  /* ---------------------------------------------------------------- */

  "action.back": "Back",
  "action.continue": "Continue",
  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.edit": "Edit",
  "action.close": "Close",
  "action.add": "Add",
  "action.remove": "Remove",

  "state.loading": "Loading…",
  "state.empty": "No data",
  "state.notSet": "Not set",
}
