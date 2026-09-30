"use client"

import { useEffect, useState } from "react"
import { Globe, Bell, Moon, Check, Building2, Mail } from "@/lib/icons"
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
  writeCurrency,
  writeLanguage,
} from "@/lib/locale"
import { useTx } from "@/lib/i18n"

/* This screen carries its own catalogue, in six languages, and it is the
   only place in the app where Spanish, Portuguese, Arabic and Kiswahili
   exist. lib/i18n has two languages; narrowing this one to match would
   throw away four real translations, so it stays and the rest of the file
   is wired to it.
 *
 * It is a catalogue, so the unlocalized-text checker must not count its
 * contents. Everything OUTSIDE the marker is still checked.
 *
 * i18n-ignore-start: this map IS the translations */
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
    country: "Pays",
    countryNone: "Non renseigné",
    countryNote:
      "Vos montants sont affichés dans cette devise. Aucune conversion n'est faite : ce sont vos propres chiffres.",
    countryNoneNote:
      "Sans pays, les montants sont affichés en euros par défaut.",
    orgPlaceholder: "Ex. Terminal Atlantique SA",
    savedNotice: "Enregistré.",
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
    country: "Country",
    countryNone: "Not set",
    countryNote:
      "Your amounts are shown in this currency. Nothing is converted: these are your own figures.",
    countryNoneNote:
      "With no country set, amounts default to euros.",
    orgPlaceholder: "e.g. Atlantic Terminal Ltd",
    savedNotice: "Saved.",
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
    country: "País",
    countryNone: "Sin especificar",
    countryNote:
      "Sus importes se muestran en esta moneda. No se hace ninguna conversión: son sus propias cifras.",
    countryNoneNote:
      "Sin país, los importes se muestran en euros por defecto.",
    orgPlaceholder: "Ej. Terminal Atlántico SA",
    savedNotice: "Guardado.",
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
    country: "País",
    countryNone: "Não indicado",
    countryNote:
      "Os seus montantes são apresentados nesta moeda. Não é feita nenhuma conversão: são os seus próprios números.",
    countryNoneNote:
      "Sem país, os montantes são apresentados em euros por predefinição.",
    orgPlaceholder: "Ex. Terminal Atlântico SA",
    savedNotice: "Guardado.",
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
    country: "البلد",
    countryNone: "غير محدد",
    countryNote:
      "تُعرض مبالغك بهذه العملة. لا يتم أي تحويل: هذه أرقامك الخاصة.",
    countryNoneNote: "بدون بلد، تُعرض المبالغ باليورو افتراضياً.",
    orgPlaceholder: "مثال: محطة الأطلسي",
    savedNotice: "تم الحفظ.",
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
    country: "Nchi",
    countryNone: "Haijawekwa",
    countryNote:
      "Kiasi chako kinaonyeshwa kwa sarafu hii. Hakuna ubadilishaji unaofanyika: hizi ni namba zako mwenyewe.",
    countryNoneNote: "Bila nchi, kiasi kinaonyeshwa kwa euro kwa chaguo-msingi.",
    orgPlaceholder: "Mf. Terminal Atlantique SA",
    savedNotice: "Imehifadhiwa.",
  },
}
/* i18n-ignore-end */

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "bg-accent" : "bg-foreground/15"
      )}
      role="switch"
      aria-checked={on}
      aria-label={label}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform rtl:left-auto rtl:right-0",
          on ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5 rtl:-translate-x-0.5"
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
    // A new country brings its own currency; the onboarding's choice
    // belonged to the old one.
    writeCurrency("")
  }

  const toggleDark = () => {
    writeTheme(dark ? "light" : "dark")
    setDark(!dark)
  }

  const revertSettings = () => {
    setCompanyName(readCompanyName())
    setTimezoneId(readTimezoneId())
  }

  const saveSettings = () => {
    writeCompanyName(companyName)
    writeTimezoneId(timezoneId)

    setSaved(true)

    window.setTimeout(() => setSaved(false), 2500)
  }

  const t = UI[lang] ?? UI.fr

  /* The two-language translator, for the few strings that come from
     lib/locale.ts rather than the six-language map above. */
  const tx = useTx()
  const isRTL = lang === "ar"

  const country = COUNTRIES.find((item) => item.code === countryCode)
  const language = LANGUAGES.find((item) => item.code === lang)
  const FIELD =
    "mt-1.5 w-full rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-brand [&>option]:text-[#141414]"

  const preferences = [
    { icon: Bell, title: t.alerts, desc: t.alertsDesc, on: toggles.alerts, change: () => toggle("alerts") },
    { icon: Mail, title: t.weekly, desc: t.weeklyDesc, on: toggles.weekly, change: () => toggle("weekly") },
    { icon: Moon, title: t.dark, desc: t.darkDesc, on: dark, change: toggleDark },
  ]

  /* The Ask SentrIA layout: lime card and preferences on the left, the
     language in the grey panel, the organisation in the black card. */
  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_300px]",
        isRTL && "text-right"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* ---------------------------------------------------------- LEFT */}
      <div className="flex flex-col gap-4">
        <div className="rounded-[28px] bg-brand p-5 text-[#141414]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-brand">
              <Globe className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">SentrIA</span>
              <span className="block text-[11px] text-[#141414]/65">{tx("Paramètres", "Settings")}</span>
            </span>
          </div>
          <p className="mt-5 truncate font-heading text-2xl font-semibold tracking-tight" title={companyName}>
            {companyName || t.org}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-[#141414]/70">
            {[language?.label, country ? tx(country.name.fr, country.name.en) : null].filter(Boolean).join(" · ")}
          </p>
        </div>

        <section className="rounded-[28px] bg-card p-5 shadow-sm">
          <h3 className="font-heading text-xl font-semibold tracking-tight">{t.prefs}</h3>
          <ul className="mt-4 flex flex-col gap-2">
            {preferences.map((row) => {
              const Icon = row.icon
              return (
                <li key={row.title} className="flex items-center gap-3 rounded-2xl bg-muted px-3.5 py-3">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{row.title}</span>
                    <span className="block text-[11px] leading-4 text-muted-foreground">{row.desc}</span>
                  </span>
                  <Toggle on={row.on} onChange={row.change} label={row.title} />
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {/* -------------------------------------------------------- CENTER */}
      <section className="rounded-[28px] bg-foreground/[0.055] p-5 sm:p-6">
        <h2 className="font-heading text-3xl font-semibold leading-[1.05] tracking-tight">{t.title}</h2>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-brand ring-2 ring-brand/30" aria-hidden="true" />
          {t.subtitle}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LANGUAGES.map((item) => {
            const active = lang === item.code

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => chooseLanguage(item.code)}
                aria-pressed={active}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-[22px] p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-[var(--ink)] text-white" : "bg-card hover:bg-card/70"
                )}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{item.label}</span>
                  <span className={cn("block text-xs", active ? "text-white/65" : "text-muted-foreground")}>
                    {tx(item.region.fr, item.region.en)}
                  </span>
                  {/* The honest part. Six languages are offered and they
                      do not mean the same thing: SentrIA answers in all
                      of them because the model writes the reply, while
                      the interface exists in two. Saying so is the
                      difference between a feature and a promise. */}
                  <span className={cn("mt-1.5 block text-[10px] leading-4", active ? "text-white/55" : "text-muted-foreground")}>
                    {languagePromise(item, tx)}
                  </span>
                </span>

                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    active ? "bg-brand text-[#141414]" : "bg-muted"
                  )}
                  aria-hidden="true"
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* --------------------------------------------------------- RIGHT */}
      <section className="rounded-[28px] bg-[var(--ink)] p-5 text-white lg:col-start-2 xl:col-start-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl font-semibold tracking-tight">{t.org}</h3>
          <Building2 className="h-4 w-4 text-white/50" aria-hidden="true" />
        </div>
        <p className="mt-1 text-xs text-white/55">{t.orgDesc}</p>

        <div className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-xs font-semibold text-white/70">{t.orgName}</span>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder={t.orgPlaceholder}
              autoComplete="organization"
              className={FIELD}
            />
          </label>

          {/* Country, and therefore currency. Choosing a country also
              fills the timezone in, since that is the usual answer. */}
          <label className="block">
            <span className="text-xs font-semibold text-white/70">{t.country}</span>
            <select
              value={countryCode}
              onChange={(event) => {
                const code = event.target.value
                chooseCountry(code)
                const picked = COUNTRIES.find((item) => item.code === code)
                if (picked) setTimezoneId(picked.timezoneId)
              }}
              className={FIELD}
            >
              <option value="">{t.countryNone}</option>
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {tx(item.name.fr, item.name.en)} · {item.currency.symbol}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-[10px] leading-4 text-white/50">
              {countryCode ? t.countryNote : t.countryNoneNote}
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-white/70">{t.timezone}</span>
            <select value={timezoneId} onChange={(event) => setTimezoneId(event.target.value)} className={FIELD}>
              {TIMEZONES.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={revertSettings}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={saveSettings}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-[#141414] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {t.save}
          </button>
        </div>

        {saved && (
          <p role="status" className="mt-3 text-right text-sm font-semibold text-brand">
            {t.savedNotice}
          </p>
        )}
      </section>
    </div>
  )
}
