import { knownPeople, personName, lifeDates, searchPeople } from "./people.js"

export function setupPersonSearch({container, getData, onSelect}) {
  if (!container) return
  container.innerHTML = `
    <div class="search-card">
      <div class="search-card__header">
        <span class="search-card__eyebrow">Navigation rapide</span>
        <div class="search-card__title">Rechercher une personne</div>
        <div class="search-card__subtitle">Prénom, nom ou année de naissance</div>
      </div>
      <div class="search-card__input-row">
        <svg class="search-card__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
        <input id="SearchPersonInput" type="search" placeholder="Un prénom, un nom…" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Rechercher une personne" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="SearchDropdown" />
        <button type="button" class="search-card__clear" aria-label="Effacer la recherche" hidden>×</button>
      </div>
      <div class="search-card__meta"><span data-search-count role="status" aria-live="polite"></span><span class="search-card__hint">Prénom, nom ou année</span></div>
      <div class="search-card__results is-hidden">
        <div class="search-card__results-heading">Choisissez une personne</div>
        <div id="SearchDropdown" class="search-card__dropdown" role="listbox" aria-label="Personnes trouvées"></div>
        <p class="search-card__empty is-hidden">Aucune personne trouvée. Essayez un autre prénom ou nom.</p>
        <button type="button" class="search-card__dismiss">Fermer la recherche</button>
      </div>
    </div>`
  const input = container.querySelector("input")
  const dropdown = container.querySelector("#SearchDropdown")
  const resultsPanel = container.querySelector(".search-card__results")
  const count = container.querySelector("[data-search-count]")
  const empty = container.querySelector(".search-card__empty")
  const clear = container.querySelector(".search-card__clear")
  let matches = []
  let activeIndex = -1
  let isOpen = false

  const close = () => {
    isOpen = false
    resultsPanel.classList.add("is-hidden")
    input.setAttribute("aria-expanded", "false")
    input.removeAttribute("aria-activedescendant")
    document.body.classList.remove("is-person-search-open")
  }
  const choose = person => {
    close()
    input.value = ""
    clear.hidden = true
    count.textContent = `${knownPeople(getData()).length} personnes dans cet arbre`
    input.blur()
    onSelect(person.id)
  }
  const highlight = index => {
    activeIndex = index
    Array.from(dropdown.children).forEach((row, i) => row.setAttribute("aria-selected", String(i === index)))
    const row = dropdown.children[index]
    if (row) {
      input.setAttribute("aria-activedescendant", row.id)
      row.scrollIntoView({block: "nearest"})
    }
  }
  const render = () => {
    isOpen = true
    matches = searchPeople(getData(), input.value)
    activeIndex = -1
    clear.hidden = !input.value
    dropdown.replaceChildren()
    input.removeAttribute("aria-activedescendant")
    resultsPanel.classList.remove("is-hidden")
    input.setAttribute("aria-expanded", "true")
    document.body.classList.add("is-person-search-open")
    empty.classList.toggle("is-hidden", matches.length > 0)
    count.textContent = input.value.trim()
      ? `${matches.length} résultat${matches.length > 1 ? "s" : ""}`
      : `${knownPeople(getData()).length} personnes dans cet arbre`
    container.querySelector(".search-card__results-heading").textContent = matches.length > 50
      ? "50 premières personnes · précisez votre recherche" : "Choisissez une personne"
    matches.slice(0, 50).forEach((person, index) => {
      const row = document.createElement("button")
      row.type = "button"
      row.id = `person-result-${index}`
      row.className = "search-card__option"
      row.setAttribute("role", "option")
      row.setAttribute("aria-selected", "false")
      row.tabIndex = -1
      const name = document.createElement("span")
      name.className = "search-card__option-name"
      name.textContent = personName(person)
      const dates = document.createElement("span")
      dates.className = "search-card__option-dates"
      dates.textContent = lifeDates(person)
      row.append(name, dates)
      // Keep the input focused until the selection is handled, including on touch.
      row.addEventListener("pointerdown", event => event.preventDefault())
      row.addEventListener("click", () => choose(person))
      dropdown.append(row)
    })
  }
  input.addEventListener("focus", render)
  input.addEventListener("input", render)
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!isOpen) render()
      const length = Math.min(matches.length, 50)
      if (length) highlight((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + length) % length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const person = matches[activeIndex < 0 ? 0 : activeIndex]
      if (isOpen && person) choose(person)
    } else if (event.key === "Escape") {
      close()
      input.blur()
    }
  })
  clear.addEventListener("click", () => { input.value = ""; input.focus(); render() })
  container.querySelector(".search-card__dismiss").addEventListener("click", () => { close(); input.blur() })
  container.addEventListener("focusout", () => {
    window.setTimeout(() => { if (!container.contains(document.activeElement)) close() }, 0)
  })
  document.addEventListener("pointerdown", event => { if (!container.contains(event.target)) close() })
  dropdown.addEventListener("wheel", event => event.stopPropagation())
  count.textContent = `${knownPeople(getData()).length} personnes dans cet arbre`
  return {close}
}
