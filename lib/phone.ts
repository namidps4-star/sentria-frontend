/* F-PHONE: a phone number the app can text.

   Twilio delivers to strict E.164 ("+2290197123456": a plus, the country
   code, the number, no separators), so a number is checked, and written, that
   way before it is sent. This uses
   libphonenumber-js, as the backend uses libphonenumber (pipeline/phone.py):
   do not write a phone regex here, international numbers are too varied. The
   server checks again and has the last word; this is for telling the person
   at once, in their own language. */

import {
  AsYouType,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min"
import examples from "libphonenumber-js/mobile/examples"
import { COUNTRIES, readCountryCode } from "@/lib/locale"

export type PhoneCheck =
  | { kind: "empty" }
  | { kind: "valid"; e164: string; international: string }
  | { kind: "invalid" }

/** The account's own country, when it chose one in onboarding: what a number
 *  typed without a country code is read against. */
export function defaultPhoneCountry(): CountryCode | undefined {
  const code = readCountryCode()
  return COUNTRIES.some((country) => country.code === code) ? (code as CountryCode) : undefined
}

/** "00" is the international prefix almost everywhere outside North America. */
const withPlus = (raw: string) => {
  const text = raw.trim()
  return text.startsWith("00") ? `+${text.slice(2)}` : text
}

export function checkPhone(raw: string, country?: CountryCode): PhoneCheck {
  const text = withPlus(raw)
  if (!text) return { kind: "empty" }

  // No letters: libphonenumber would read "1-800-FLOWERS" off the keypad.
  if (/[a-z]/i.test(text)) return { kind: "invalid" }

  const parsed = parsePhoneNumberFromString(text, country)
  if (!parsed || !parsed.isValid()) return { kind: "invalid" }

  return { kind: "valid", e164: parsed.number, international: parsed.formatInternational() }
}

/** The text as it should read while it is typed ("+229 01 97 12 34 56"). */
export function formatPhoneInput(raw: string, country?: CountryCode): string {
  const text = withPlus(raw)
  return text ? new AsYouType(country).input(text) : ""
}

/** A real, valid example for the placeholder. */
export function phoneExample(country?: CountryCode): string {
  const example = getExampleNumber(country ?? "BJ", examples) ?? getExampleNumber("BJ", examples)
  return example ? example.formatInternational() : "+229 01 95 12 34 56"
}
