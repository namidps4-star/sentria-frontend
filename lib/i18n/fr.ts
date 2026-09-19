/**
 * French, the source of truth.
 *
 * This file defines the message keys. `en.ts` is typed against it, so
 * TypeScript fails the build the moment a key exists here and not there.
 * That property is the whole reason this is a hand-rolled dictionary
 * rather than a library: half-translated is the failure mode that
 * actually hurts, and a compile error is the only thing that reliably
 * stops it shipping.
 *
 *
 * Scope, stated so the next person does not have to guess
 * ------------------------------------------------------
 *
 * This covers the CHROME: the sidebar, the top bar, the view titles and
 * the handful of buttons that repeat everywhere. Roughly 60 strings out
 * of about 1100 in the app.
 *
 * The view bodies are NOT here yet. dashboard-view.tsx alone carries 262
 * strings, more than the next four files together, and about 1079 are
 * still hardcoded across components and lib.
 *
 * So English is uiReady: "partial" in lib/locale.ts, and the language
 * picker says "Navigation en English · contenu encore en français".
 * English navigation beats French navigation for an English speaker;
 * claiming a full English interface would not.
 *
 *
 * What never belongs in here
 * --------------------------
 *
 * Equipment names, the company name, contractor names, CSV-derived
 * values and task keys. They are data. Translating an identifier is how
 * you end up with two rows for one crane.
 */

export const fr = {
  /* ---------------------------------------------------------------- */
  /*  Sidebar                                                          */
  /* ---------------------------------------------------------------- */

  "brand.tagline": "Industrial Intelligence",
  "brand.status.title": "SentrIA active",
  "brand.status.subtitle": "Intelligence en ligne",

  "sidebar.section.operations": "OPÉRATIONS",
  "sidebar.section.intelligence": "INTELLIGENCE",
  "sidebar.section.studio": "STUDIO",

  "sidebar.close": "Fermer la barre latérale",
  "sidebar.collapse": "Réduire la barre latérale",
  "sidebar.expand": "Déployer la barre latérale",

  /* ---------------------------------------------------------------- */
  /*  Navigation                                                       */
  /* ---------------------------------------------------------------- */

  "nav.dashboard": "Dashboard",
  "nav.calendar": "Calendrier",
  "nav.sites": "Sites",
  "nav.contractors": "Intervenants",
  "nav.ask": "Ask SentrIA",
  "nav.report": "Rapport",
  "nav.pricing": "Abonnement",
  "nav.profile": "Profil",
  "nav.settings": "Paramètres",

  /* ---------------------------------------------------------------- */
  /*  Top bar                                                          */
  /* ---------------------------------------------------------------- */

  "topbar.menu.open": "Ouvrir le menu",
  "topbar.search.placeholder": "Rechercher un actif, une alerte…",
  "topbar.search.label": "Rechercher un actif ou une alerte",
  "topbar.search.clear": "Effacer la recherche",

  /* Two keys rather than one with a plural rule inside it. A catalogue
     of plain strings is what makes the type check work, and French
     needs the agreement anyway. */
  "topbar.notifications.none": "Notifications, aucune alerte critique",
  "topbar.notifications.one": "Notifications, 1 alerte critique",
  "topbar.notifications.many": "Notifications, {count} alertes critiques",

  "topbar.account": "Compte",
  "topbar.account.of": "Compte de {name}",

  /* ---------------------------------------------------------------- */
  /*  View titles, the ones app-shell puts in the top bar              */
  /* ---------------------------------------------------------------- */

  "view.dashboard.title": "Dashboard",
  "view.dashboard.subtitle": "Vue globale des opérations",

  "view.calendar.title": "Calendrier",
  "view.calendar.subtitle": "Échéances, seuils critiques et incidents à venir",

  "view.sites.title": "Sites",
  "view.sites.subtitle": "Gérez vos usines, ateliers et clients",

  "view.ask.title": "Ask SentrIA",
  "view.ask.subtitle": "Votre analyste augmenté par l'IA",

  "view.pricing.title": "Abonnement",
  "view.pricing.subtitle": "Choisissez le plan adapté à vos opérations",

  "view.profile.title": "Profil",
  "view.profile.subtitle": "Votre compte et votre activité",

  "view.settings.title": "Paramètres",
  "view.settings.subtitle": "Langue, notifications et organisation",

  "view.report.title": "Rapport",
  "view.report.subtitle": "Analyse détaillée de vos opérations",

  "view.contractors.title": "Intervenants",
  "view.contractors.subtitle": "Qui est disponible, et qui fait quoi",

  /* ---------------------------------------------------------------- */
  /*  Buttons and states that repeat across views                      */
  /* ---------------------------------------------------------------- */

  "action.back": "Retour",
  "action.continue": "Continuer",
  "action.save": "Enregistrer",
  "action.cancel": "Annuler",
  "action.edit": "Modifier",
  "action.close": "Fermer",
  "action.add": "Ajouter",
  "action.remove": "Retirer",

  "state.loading": "Chargement…",
  "state.empty": "Aucune donnée",
  "state.notSet": "Non renseigné",
} as const
