"use client"

/* A phone number input that only lets a real number through (F-PHONE).

   It formats as the person types ("+229 01 97 12 34 56"), reads a number typed
   without a country code against the account's own country, and says in the
   reader's language what is wrong. The value it hands back is the text on
   screen; `checkPhone` (lib/phone.ts) turns it into the E.164 that is sent. */

import { useId, useState, type ChangeEvent } from "react"
import { useTx } from "@/lib/i18n"
import { checkPhone, defaultPhoneCountry, formatPhoneInput, phoneExample } from "@/lib/phone"
import { cn } from "@/lib/utils"

export function PhoneField({
  value,
  onChange,
  submitted = false,
  inputClassName,
  hideLabel = false,
}: {
  value: string
  onChange: (value: string) => void
  /** The form was submitted with this value: show the error even if the
   *  field was never left. */
  submitted?: boolean
  inputClassName?: string
  /** The caller draws its own label beside the field: keep this one for screen readers only. */
  hideLabel?: boolean
}) {
  const tx = useTx()
  const [country] = useState(() => defaultPhoneCountry())
  const [touched, setTouched] = useState(false)
  const errorId = useId()

  const check = checkPhone(value, country)
  const example = phoneExample(country)
  const showError = (touched || submitted) && check.kind === "invalid"

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    const atEnd = event.target.selectionStart === next.length

    // Format while typing or pasting, at the end of the text. Deleting, or
    // editing in the middle, is left alone: reformatting would put a
    // deleted space straight back and move the caret.
    onChange(next.length > value.length && atEnd ? formatPhoneInput(next, country) : next)
  }

  return (
    <div className="block">
      <label className="block">
        <span className={cn("text-[10px] font-medium uppercase tracking-wider text-muted-foreground", hideLabel && "sr-only")}>
          {tx("Téléphone", "Phone")}
        </span>

        <input
          type="tel"
          inputMode="tel"
          value={value}
          onChange={handleChange}
          onBlur={() => {
            setTouched(true)
            if (check.kind === "valid") onChange(check.international)
          }}
          placeholder={example}
          autoComplete="tel"
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          data-phone-input=""
          className={cn(
            "w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-ring",
            !hideLabel && "mt-1.5",
            showError ? "border-destructive" : "border-border",
            inputClassName
          )}
        />
      </label>

      {showError && (
        <p id={errorId} role="alert" data-phone-error="" className="mt-1.5 text-xs leading-4 text-destructive">
          {tx(
            `Numéro invalide. Format international, par exemple ${example}.`,
            `Invalid number. Use the international format, e.g. ${example}.`
          )}
        </p>
      )}
    </div>
  )
}
