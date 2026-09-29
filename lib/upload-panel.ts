import { useSyncExternalStore } from "react"

import type { UploadState } from "./upload"

/** The import panel's state, shared outside React's tree: the dashboard
 *  publishes it, the app shell draws it (components/sentria/
 *  upload-panel-host.tsx), so it stays up when the dashboard swaps to
 *  another sector's layout after the import. */
export type UploadPanel = {
  open: boolean
  title: string
  state: UploadState
  busy: boolean
}

let panel: UploadPanel = { open: false, title: "", state: { phase: "idle" }, busy: false }
const listeners = new Set<() => void>()

export function setUploadPanel(patch: Partial<UploadPanel>) {
  panel = { ...panel, ...patch }
  listeners.forEach((listener) => listener())
}

export function useUploadPanel(): UploadPanel {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => panel,
    () => panel
  )
}
