import { useSyncExternalStore } from "react"

/** Texts drafted when a contractor was removed and their tasks handed over
 *  (F-CDELETE). Per-contractor SMS is not live yet (F-SMS2), so nothing is
 *  sent: the drafts are kept here, in this browser, until the person
 *  discards them. They are listed in account.ts so the next person who
 *  signs in on this browser does not see them.
 *
 *  When texting goes live, the Send button reads from this list. */

export const SMS_DRAFTS_KEY = "sentria_sms_drafts"
const EVENT = "sentria-sms-drafts"

/** More than this and the oldest go: a draft nobody sent for a month is
 *  not coming back. */
const MAX_DRAFTS = 50

export type SmsDraft = {
  id: string
  createdAt: string
  contractorId: string
  name: string
  phone: string | null
  smsReady: boolean | null
  /** Who left, for context on the card. */
  from: string
  body: string
}

function parse(raw: string | null): SmsDraft[] {
  if (!raw) return []

  try {
    const value = JSON.parse(raw)

    return Array.isArray(value)
      ? value.filter(
          (item): item is SmsDraft =>
            !!item && typeof item.id === "string" && typeof item.body === "string"
        )
      : []
  } catch {
    return []
  }
}

let cachedRaw: string | null = null
let cachedList: SmsDraft[] = []
const EMPTY: SmsDraft[] = []

function snapshot(): SmsDraft[] {
  let raw: string | null = null

  try {
    raw = localStorage.getItem(SMS_DRAFTS_KEY)
  } catch {
    return cachedList
  }

  // The same array until the stored text changes: useSyncExternalStore
  // compares snapshots by identity.
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = parse(raw)
  }

  return cachedList
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)

  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function write(list: SmsDraft[]) {
  try {
    localStorage.setItem(SMS_DRAFTS_KEY, JSON.stringify(list.slice(-MAX_DRAFTS)))
  } catch {
    // Storage full or blocked: the drafts were shown once; nothing else to do.
  }

  window.dispatchEvent(new Event(EVENT))
}

export function readSmsDrafts(): SmsDraft[] {
  return snapshot()
}

export function addSmsDrafts(drafts: SmsDraft[]) {
  if (drafts.length === 0) return

  write([...snapshot(), ...drafts])
}

export function discardSmsDraft(id: string) {
  write(snapshot().filter((draft) => draft.id !== id))
}

export function useSmsDrafts(): SmsDraft[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY)
}
