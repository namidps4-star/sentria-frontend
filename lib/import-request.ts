/* "Open the import panel", asked from anywhere (Robo's Upload a file). The
   panel lives on the dashboard's top bar, so the asker goes to the dashboard
   first. The request is remembered until the dashboard has mounted and read
   it; a dashboard that is already open hears the event at once. */

export const IMPORT_REQUEST_EVENT = "sentria:open-import"

let pending = false

export function requestImportOpen(): void {
  pending = true

  if (typeof window !== "undefined") window.dispatchEvent(new Event(IMPORT_REQUEST_EVENT))
}

/** True once per request. */
export function consumeImportRequest(): boolean {
  const asked = pending

  pending = false

  return asked
}
