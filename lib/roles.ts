/* F-ROLE: a contractor's role stays free text on purpose (an enum would force
   the operator to lie across the sectors' job titles). This only suggests the
   roles this company's own people already carry, so "electrician" is not
   typed four ways. Same company only: the list it reads is already scoped to
   the company. No schema, no validation, nothing blocks a role nobody typed. */

type WithRole = { role?: string | null }

/** Case, accents and extra spaces do not make a different role. */
function key(role: string): string {
  return role
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

/** On a tie, the spelling that starts with a capital reads better in a list. */
function capitalised(role: string): boolean {
  const first = role.charAt(0)
  return first !== first.toLowerCase()
}

/** The roles already in use, most used first. When people spelled the same
 *  role differently, the spelling most of them used is the one offered. */
export function roleSuggestions(people: WithRole[], limit = 12): string[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>()

  for (const person of people) {
    const role = person.role?.trim()
    if (!role) continue

    const k = key(role)
    const group = groups.get(k) ?? { count: 0, spellings: new Map<string, number>() }

    group.count += 1
    group.spellings.set(role, (group.spellings.get(role) ?? 0) + 1)
    groups.set(k, group)
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map((group) => [...group.spellings.entries()].sort((a, b) => b[1] - a[1] || Number(capitalised(b[0])) - Number(capitalised(a[0])) || a[0].localeCompare(b[0]))[0][0])
    .slice(0, limit)
}
