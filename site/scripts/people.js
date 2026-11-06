// Shared, side-effect-free helpers for the search and mobile family explorer.
export function normalizeSearch(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe").replace(/æ/gi, "ae").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

export function personName(person) {
  return [person?.data?.["first name"], person?.data?.["last name"]]
    .filter(value => value && value !== "null").join(" ").trim() || "Nom non renseigné"
}

export function knownPeople(dataset = []) {
  return dataset.filter(person => person?.id != null && person.data && !person._new_rel_data && !person.to_add)
}

export function dateYear(value) {
  if (!value || /^1970-01-01(?:T|$)/.test(value)) return ""
  const match = String(value).match(/(?:^|\D)(\d{4})(?:\D|$)/)
  return match ? match[1] : ""
}

export function lifeDates(person) {
  const birth = dateYear(person?.data?.birthday)
  const death = dateYear(person?.data?.lastday)
  if (birth && death) return `${birth} – ${death}`
  if (birth) return `Naissance en ${birth}`
  if (death) return `Décès en ${death}`
  return "Dates non renseignées"
}

export function searchPeople(dataset, query = "") {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
  return knownPeople(dataset).map(person => {
    const name = normalizeSearch(personName(person))
    const searchable = normalizeSearch(`${personName(person)} ${person.data.birthday || ""} ${person.data.lastday || ""}`)
    return { person, name, searchable }
  }).filter(item => tokens.every(token => item.searchable.includes(token) || item.searchable.replace(/ /g, "").includes(token)))
    .sort((a, b) => {
      const first = tokens[0]
      const priority = item => first && item.name.startsWith(first) ? 0 : 1
      return priority(a) - priority(b) || personName(a.person).localeCompare(personName(b.person), "fr")
    }).map(item => item.person)
}

export function familyOf(dataset, personId) {
  const people = knownPeople(dataset)
  const byId = new Map(people.map(person => [String(person.id), person]))
  const person = byId.get(String(personId))
  if (!person) return null
  const parentIds = profile => [...(profile.rels?.parents || []), profile.rels?.father, profile.rels?.mother].filter(id => id != null)
  const resolve = ids => [...new Set(ids.map(String))].map(id => byId.get(id)).filter(relative => relative && relative !== person)
  const parents = resolve([
    ...parentIds(person),
    ...people.filter(profile => profile.rels?.children?.some(id => String(id) === String(person.id))).map(profile => profile.id)
  ])
  const byBirth = (a, b) => (Number(dateYear(a.data.birthday)) || Infinity) - (Number(dateYear(b.data.birthday)) || Infinity)
    || personName(a).localeCompare(personName(b), "fr")
  const sharedParentIds = new Set(parents.map(parent => String(parent.id)))
  const siblings = resolve([
    ...parents.flatMap(parent => parent.rels?.children || []),
    ...people.filter(profile => parentIds(profile).some(id => sharedParentIds.has(String(id)))).map(profile => profile.id)
  ]).sort(byBirth)
  const spouses = resolve(person.rels?.spouses || [])
  const children = resolve([
    ...(person.rels?.children || []),
    ...people.filter(profile => parentIds(profile).some(id => String(id) === String(person.id))).map(profile => profile.id)
  ]).sort(byBirth)
  return { person, parents, siblings, spouses, children }
}
