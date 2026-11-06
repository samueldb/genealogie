import { familyOf, personName, lifeDates } from "./people.js"

export function setupMobileFamily({container, getData, getPersonId, onSelect, onOpenProfile}) {
  if (!container) return null
  const portrait = person => {
    const image = document.createElement("img")
    image.src = person.data.avatar || "assets/images/profil_base.svg"
    image.alt = ""
    image.loading = "lazy"
    image.addEventListener("error", () => { image.src = "assets/images/profil_base.svg" }, {once: true})
    return image
  }
  let lastPersonId = null
  const update = () => {
    const family = familyOf(getData(), getPersonId())
    if (!family) return
    const changedPerson = lastPersonId !== String(family.person.id)
    const scrollTop = changedPerson ? 0 : container.scrollTop
    lastPersonId = String(family.person.id)
    container.replaceChildren()
    const intro = document.createElement("p")
    intro.className = "mobile-family__intro"
    intro.textContent = "Touchez un proche pour explorer sa famille."
    container.append(intro)

    const relatives = (title, people, compact = false) => {
      if (!people.length) return
      const section = document.createElement("section")
      section.className = "mobile-family__group"
      const heading = document.createElement("h2")
      heading.className = "mobile-family__group-title"
      heading.textContent = `${title} · ${people.length}`
      const list = document.createElement("div")
      list.className = `mobile-family__relatives${compact ? " mobile-family__relatives--parents" : ""}`
      people.forEach(person => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "mobile-family__relative"
        button.setAttribute("aria-label", `Explorer la famille de ${personName(person)}`)
        const label = document.createElement("span")
        label.className = "mobile-family__relative-label"
        const name = document.createElement("span")
        name.className = "mobile-family__relative-name"
        name.textContent = personName(person)
        const dates = document.createElement("span")
        dates.className = "mobile-family__relative-dates"
        dates.textContent = lifeDates(person)
        label.append(name, dates)
        const arrow = document.createElement("span")
        arrow.className = "mobile-family__arrow"
        arrow.textContent = "›"
        arrow.setAttribute("aria-hidden", "true")
        button.append(portrait(person), label, arrow)
        button.addEventListener("click", () => { onSelect(person.id); container.scrollTop = 0 })
        list.append(button)
      })
      section.append(heading, list)
      container.append(section)
    }

    relatives("Parents", family.parents, true)
    const focus = document.createElement("article")
    focus.className = "mobile-family__focus"
    focus.setAttribute("aria-label", "Personne explorée")
    const details = document.createElement("div")
    const eyebrow = document.createElement("span")
    eyebrow.className = "mobile-family__eyebrow"
    eyebrow.textContent = "Au cœur de cette famille"
    const name = document.createElement("h1")
    name.className = "mobile-family__name"
    name.tabIndex = -1
    name.textContent = personName(family.person)
    const dates = document.createElement("p")
    dates.className = "mobile-family__dates"
    dates.textContent = lifeDates(family.person)
    details.append(eyebrow, name, dates)
    const openProfile = document.createElement("button")
    openProfile.type = "button"
    openProfile.className = "mobile-family__profile"
    openProfile.textContent = "Voir la fiche"
    openProfile.addEventListener("click", onOpenProfile)
    focus.append(portrait(family.person), details, openProfile)
    container.append(focus)
    relatives("Frères et sœurs", family.siblings)
    relatives(family.spouses.length > 1 ? "Conjoints" : "Conjoint", family.spouses)
    relatives("Enfants", family.children)
    if (!family.parents.length && !family.siblings.length && !family.spouses.length && !family.children.length) {
      const empty = document.createElement("p")
      empty.className = "mobile-family__empty"
      empty.textContent = "Aucun proche n’est encore renseigné pour cette personne. Sa fiche permet d’en ajouter."
      container.append(empty)
    }
    container.scrollTop = scrollTop
    if (changedPerson && container.clientHeight > 0 && container.clientHeight < 360) {
      container.scrollTop = Math.max(0, focus.getBoundingClientRect().top - container.getBoundingClientRect().top - 16)
    }
  }
  return {update}
}
