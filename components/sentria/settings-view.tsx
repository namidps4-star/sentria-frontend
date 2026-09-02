"use client"

import { useState } from "react"
import { Globe, Bell, Moon, Check, Building2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

const LANGUAGES = [
  { code: "fr", label: "Français", region: "France · Afrique" },
  { code: "en", label: "English", region: "Global" },
  { code: "es", label: "Español", region: "Amériques" },
  { code: "pt", label: "Português", region: "Brésil" },
  { code: "ar", label: "العربية", region: "Maghreb" },
  { code: "sw", label: "Kiswahili", region: "Afrique de l'Est" },
]

<<<<<<< HEAD
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        on ? "bg-accent" : "bg-muted",
=======
const UI: Record<string, Record<string, string>> = {
  fr: {
    title: "Langue & région",
    subtitle: "L'interface s'adapte à votre territoire.",
    prefs: "Préférences",
    alerts: "Alertes en temps réel",
    alertsDesc: "Recevoir les signaux critiques instantanément.",
    weekly: "Rapport hebdomadaire",
    weeklyDesc: "Synthèse e-mail tous les lundis.",
    dark: "Mode sombre",
    darkDesc: "Basculer le thème de l'interface.",
    org: "Organisation",
    orgDesc: "Espace de travail partagé.",
    orgName: "Nom de l'organisation",
    timezone: "Fuseau horaire",
    cancel: "Annuler",
    save: "Enregistrer",
  },
  en: {
    title: "Language & region",
    subtitle: "The interface adapts to your territory.",
    prefs: "Preferences",
    alerts: "Real-time alerts",
    alertsDesc: "Receive critical signals instantly.",
    weekly: "Weekly report",
    weeklyDesc: "Email summary every Monday.",
    dark: "Dark mode",
    darkDesc: "Switch the interface theme.",
    org: "Organisation",
    orgDesc: "Shared workspace.",
    orgName: "Organisation name",
    timezone: "Timezone",
    cancel: "Cancel",
    save: "Save",
  },
  es: {
    title: "Idioma & región",
    subtitle: "La interfaz se adapta a su territorio.",
    prefs: "Preferencias",
    alerts: "Alertas",
    alertsDesc: "Recibir señales críticas al instante.",
    weekly: "Informe semanal",
    weeklyDesc: "Resumen por correo cada lunes.",
    dark: "Modo oscuro",
    darkDesc: "Cambiar el tema de la interfaz.",
    org: "Organización",
    orgDesc: "Espacio de trabajo compartido.",
    orgName: "Nombre de la organización",
    timezone: "Zona horaria",
    cancel: "Cancelar",
    save: "Guardar",
  },
  pt: {
    title: "Idioma & região",
    subtitle: "A interface adapta-se ao seu território.",
    prefs: "Preferências",
    alerts: "Alertas em tempo real",
    alertsDesc: "Receber sinais críticos instantaneamente.",
    weekly: "Relatório semanal",
    weeklyDesc: "Resumo por e-mail todas as segundas.",
    dark: "Modo escuro",
    darkDesc: "Alternar o tema da interface.",
    org: "Organização",
    orgDesc: "Espaço de trabalho partilhado.",
    orgName: "Nome da organização",
    timezone: "Fuso horário",
    cancel: "Cancelar",
    save: "Guardar",
  },
  ar: {
    title: "اللغة والمنطقة",
    subtitle: "تتكيف الواجهة مع منطقتك.",
    prefs: "التفضيلات",
    alerts: "تنبيهات فورية",
    alertsDesc: "استقبال الإشارات الحرجة فوراً.",
    weekly: "تقرير أسبوعي",
    weeklyDesc: "ملخص بالبريد الإلكتروني كل اثنين.",
    dark: "الوضع الداكن",
    darkDesc: "تبديل سمة الواجهة.",
    org: "المنظمة",
    orgDesc: "مساحة عمل مشتركة.",
    orgName: "اسم المنظمة",
    timezone: "المنطقة الزمنية",
    cancel: "إلغاء",
    save: "حفظ",
  },
  sw: {
    title: "Lugha & eneo",
    subtitle: "Kiolesura kinabadilika kulingana na eneo lako.",
    prefs: "Mapendeleo",
    alerts: "Arifa za wakati halisi",
    alertsDesc: "Pokea ishara muhimu mara moja.",
    weekly: "Ripoti ya kila wiki",
    weeklyDesc: "Muhtasari wa barua pepe kila Jumatatu.",
    dark: "Hali ya giza",
    darkDesc: "Badilisha mandhari ya kiolesura.",
    org: "Shirika",
    orgDesc: "Nafasi ya kazi inayoshirikiwa.",
    orgName: "Jina la shirika",
    timezone: "Eneo la saa",
    cancel: "Ghairi",
    save: "Hifadhi",
  },
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        on ? "bg-accent" : "bg-muted"
>>>>>>> feature/layout
      )}
      role="switch"
      aria-checked={on}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
<<<<<<< HEAD
          on ? "translate-x-[22px]" : "translate-x-0.5",
=======
          on ? "translate-x-[22px]" : "translate-x-0.5"
>>>>>>> feature/layout
        )}
      />
    </button>
  )
}

export function SettingsView() {
  const [lang, setLang] = useState("fr")
<<<<<<< HEAD
  const [toggles, setToggles] = useState({ alerts: true, weekly: false, dark: false })
  const t = (k: keyof typeof toggles) => setToggles((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
=======

  const [toggles, setToggles] = useState({
    alerts: true,
    weekly: false,
    dark: false,
  })

  const toggle = (key: keyof typeof toggles) => {
    setToggles((state) => ({
      ...state,
      [key]: !state[key],
    }))
  }

  const saveSettings = () => {
    // Keep settings unrelated to sector configuration here.
    // Sector selection is handled by onboarding.
  }

  const t = UI[lang] ?? UI.fr
  const isRTL = lang === "ar"

  return (
    <div
      className={cn(
        "mx-auto max-w-3xl space-y-6",
        isRTL && "text-right"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
>>>>>>> feature/layout
      {/* Language */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Globe className="h-5 w-5" />
          </span>
<<<<<<< HEAD
          <div>
            <h3 className="font-heading text-lg font-bold">Langue & région</h3>
            <p className="text-sm text-muted-foreground">L'interface s'adapte à votre territoire.</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {LANGUAGES.map((l) => {
            const active = lang === l.code
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-3.5 text-left transition-colors",
                  active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-ring",
                )}
              >
                <div>
                  <p className="font-semibold">{l.label}</p>
                  <p className={cn("text-xs", active ? "text-background/70" : "text-muted-foreground")}>
                    {l.region}
                  </p>
                </div>
=======

          <div>
            <h3 className="font-heading text-lg font-bold">
              {t.title}
            </h3>

            <p className="text-sm text-muted-foreground">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {LANGUAGES.map((language) => {
            const active = lang === language.code

            return (
              <button
                key={language.code}
                type="button"
                onClick={() => setLang(language.code)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border p-3.5 text-left transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:border-ring"
                )}
              >
                <div>
                  <p className="font-semibold">
                    {language.label}
                  </p>

                  <p
                    className={cn(
                      "text-xs",
                      active
                        ? "text-background/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {language.region}
                  </p>
                </div>

>>>>>>> feature/layout
                {active && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

<<<<<<< HEAD
      {/* Notifications & appearance */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">Préférences</h3>
        <div className="mt-4 divide-y divide-border">
          {[
            { icon: Bell, key: "alerts" as const, title: "Alertes en temps réel", desc: "Recevoir les signaux critiques instantanément." },
            { icon: Mail, key: "weekly" as const, title: "Rapport hebdomadaire", desc: "Synthèse e-mail tous les lundis." },
            { icon: Moon, key: "dark" as const, title: "Mode sombre", desc: "Basculer le thème de l'interface." },
          ].map((row) => {
            const Icon = row.icon
            return (
              <div key={row.key} className="flex items-center gap-3 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.desc}</p>
                </div>
                <Toggle on={toggles[row.key]} onChange={() => t(row.key)} />
=======
      {/* Preferences */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">
          {t.prefs}
        </h3>

        <div className="mt-4 divide-y divide-border">
          {[
            {
              icon: Bell,
              key: "alerts" as const,
              title: t.alerts,
              desc: t.alertsDesc,
            },
            {
              icon: Mail,
              key: "weekly" as const,
              title: t.weekly,
              desc: t.weeklyDesc,
            },
            {
              icon: Moon,
              key: "dark" as const,
              title: t.dark,
              desc: t.darkDesc,
            },
          ].map((row) => {
            const Icon = row.icon

            return (
              <div
                key={row.key}
                className="flex items-center gap-3 py-4"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-4 w-4" />
                </span>

                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {row.title}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {row.desc}
                  </p>
                </div>

                <Toggle
                  on={toggles[row.key]}
                  onChange={() => toggle(row.key)}
                />
>>>>>>> feature/layout
              </div>
            )
          })}
        </div>
      </section>

<<<<<<< HEAD
      {/* Organization */}
=======
      {/* Organisation */}
>>>>>>> feature/layout
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-5 w-5" />
          </span>
<<<<<<< HEAD
          <div>
            <h3 className="font-heading text-lg font-bold">Organisation</h3>
            <p className="text-sm text-muted-foreground">Espace de travail partagé.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Nom de l'organisation</span>
            <input
              defaultValue="Observatoire Territorial Global"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Fuseau horaire</span>
            <select className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring">
              <option>GMT (Dakar, Abidjan)</option>
=======

          <div>
            <h3 className="font-heading text-lg font-bold">
              {t.org}
            </h3>

            <p className="text-sm text-muted-foreground">
              {t.orgDesc}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">
              {t.orgName}
            </span>

            <input
              defaultValue="Sentria Africa"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              {t.timezone}
            </span>

            <select className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring">
              <option>GMT (Cotonou, Dakar, Abidjan)</option>
              <option>WAT (Lagos, Kinshasa)</option>
>>>>>>> feature/layout
              <option>CET (Paris, Lyon)</option>
              <option>BRT (São Paulo)</option>
              <option>EAT (Nairobi)</option>
            </select>
          </label>
        </div>
<<<<<<< HEAD
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
            Annuler
          </button>
          <button className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90">
            Enregistrer
=======

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            {t.cancel}
          </button>

          <button
            type="button"
            onClick={saveSettings}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            {t.save}
>>>>>>> feature/layout
          </button>
        </div>
      </section>
    </div>
  )
<<<<<<< HEAD
}
=======
}
>>>>>>> feature/layout
