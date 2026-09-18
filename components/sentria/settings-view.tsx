"use client"

import { useEffect, useState } from "react"
import { Globe, Bell, Moon, Check, Building2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { readTheme, resolvedTheme, writeTheme } from "@/lib/theme"
import {
  readCompanyName,
  readTimezoneId,
  TIMEZONES,
  writeCompanyName,
  writeTimezoneId,
} from "@/lib/company"
import {
  COUNTRIES,
  LANGUAGES,
  languagePromise,
  readCountryCode,
  readLanguage,
  writeCountryCode,
  writeLanguage,
} from "@/lib/locale"

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
      )}
      role="switch"
      aria-checked={on}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export function SettingsView() {
  /* This was useState("fr") and nothing ever wrote it down: the picker
     offered six languages, stored none of them, and no other screen
     read it. It is persisted now, and Ask SentrIA sends it. */
  const [lang, setLang] = useState("fr")

  const [countryCode, setCountryCode] = useState("")

  const [toggles, setToggles] = useState({
    alerts: true,
    weekly: false,
  })

  const toggle = (key: keyof typeof toggles) => {
    setToggles((state) => ({
      ...state,
      [key]: !state[key],
    }))
  }

  /* The dark switch used to flip a boolean nothing read. It now drives
     the real theme class, read after mount so the server and the client
     agree on the first render. */
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const sync = () => setDark(resolvedTheme(readTheme()) === "dark")

    sync()

    const media = window.matchMedia("(prefers-color-scheme: dark)")

    media.addEventListener("change", sync)
    window.addEventListener("sentria_theme_updated", sync)

    return () => {
      media.removeEventListener("change", sync)
      window.removeEventListener("sentria_theme_updated", sync)
    }
  }, [])

  /* The name was a hardcoded defaultValue and the zone a select with no
     state, so neither was ever saved or read back. Both are stored now,
     and onboarding asks for them up front. */
  const [companyName, setCompanyName] = useState("")

  const [timezoneId, setTimezoneId] = useState(TIMEZONES[0].id)

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCompanyName(readCompanyName())
    setTimezoneId(readTimezoneId())
    setLang(readLanguage())
    setCountryCode(readCountryCode())
  }, [])

  /* Applied immediately rather than on Save: the operator sees the
     picker change the interface, which is the only way to tell that it
     did anything. */
  function chooseLanguage(code: string) {
    setLang(code)
    writeLanguage(code)
  }

  function chooseCountry(code: string) {
    setCountryCode(code)
    writeCountryCode(code)
  }

  const toggleDark = () => {
    writeTheme(dark ? "light" : "dark")
    setDark(!dark)
  }

  const saveSettings = () => {
    writeCompanyName(companyName)
    writeTimezoneId(timezoneId)

    setSaved(true)

    window.setTimeout(() => setSaved(false), 2500)
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
      {/* Language */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Globe className="h-5 w-5" />
          </span>

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
                onClick={() => chooseLanguage(language.code)}
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

                  {/* The honest part. Six languages are offered and they
                      do not mean the same thing: SentrIA answers in all
                      of them because the model writes the reply, while
                      the interface exists in two. Saying so is the
                      difference between a feature and a promise. */}
                  <p
                    className={cn(
                      "mt-1 text-[10px] leading-4",
                      active ? "text-background/60" : "text-muted-foreground"
                    )}
                  >
                    {languagePromise(language)}
                  </p>
                </div>

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
              </div>
            )
          })}

          <div className="flex items-center gap-3 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Moon className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="flex-1">
              <p className="text-sm font-semibold">{t.dark}</p>

              <p className="text-xs text-muted-foreground">{t.darkDesc}</p>
            </div>

            <Toggle on={dark} onChange={toggleDark} />
          </div>
        </div>
      </section>

      {/* Organisation */}
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-5 w-5" />
          </span>

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
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Ex. Terminal Atlantique SA"
              autoComplete="organization"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            />
          </label>

          {/* Country, and therefore currency. The cost views labelled
              every figure in euros while the rates are numbers the
              operator types themselves, so a Lagos terminal's own naira
              were shown as euros. Choosing a country also fills the
              timezone in, since that is the usual answer. */}
          <label className="block">
            <span className="text-sm font-medium">Pays</span>

            <select
              value={countryCode}
              onChange={(event) => {
                const code = event.target.value

                chooseCountry(code)

                const country = COUNTRIES.find((item) => item.code === code)

                if (country) setTimezoneId(country.timezoneId)
              }}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            >
              <option value="">Non renseigné</option>

              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} · {country.currency.symbol}
                </option>
              ))}
            </select>

            <span className="mt-1.5 block text-[10px] leading-4 text-muted-foreground">
              {countryCode
                ? "Vos montants sont affichés dans cette devise. Aucune conversion n'est faite : ce sont vos propres chiffres."
                : "Sans pays, les montants sont affichés en euros par défaut."}
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              {t.timezone}
            </span>

            <select
              value={timezoneId}
              onChange={(event) => setTimezoneId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-ring"
            >
              {TIMEZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
        </div>

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
          </button>
        </div>

        {saved && (
          <p role="status" className="mt-3 text-right text-sm font-medium text-green-600">
            Enregistré.
          </p>
        )}
      </section>
    </div>
  )
}