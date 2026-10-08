import type { Availability, Contractor } from "./crm"

/* Who to offer when sending someone to a task (F-DISPATCH). Plain rules, no
   guessing: the person picks, this only puts the likeliest names first. */

const AVAILABILITY_RANK: Record<Availability, number> = {
  available: 0,
  busy: 1,
  off: 2,
}

/** The people worth offering for a task, best first.
 *  - Not offered: someone who said they are unavailable, and someone
 *    already on the task (they have their own Text button).
 *  - Order: available before busy, then people who can be texted, then the
 *    fewest open tasks, then name. */
export function rankForDispatch(people: Contractor[], onTask: string[]): Contractor[] {
  return people
    .filter((person) => person.active !== false)
    .filter((person) => person.availability !== "off")
    .filter((person) => !onTask.includes(person.id))
    .sort(
      (a, b) =>
        AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability] ||
        Number(b.sms_ready === true) - Number(a.sms_ready === true) ||
        a.open_assignments - b.open_assignments ||
        a.name.localeCompare(b.name)
    )
}

/** The one name tagged "Suggested": the first of the ranking, and only when
 *  they are free and can be texted. Otherwise nobody is suggested, because a
 *  busy person or one with no number is not a good default. */
export function suggestedId(ranked: Contractor[]): string | null {
  const first = ranked[0]

  return first && first.availability === "available" && first.sms_ready === true ? first.id : null
}
