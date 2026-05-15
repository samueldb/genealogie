const DEFAULT_AVATAR = "deschampsberger/images/profil_base.svg"
const PLACEHOLDER_DATE = "1970-01-01"
const MIN_YEAR_HEIGHT = 6
const MAX_YEAR_HEIGHT = 10
const MIN_CARD_HEIGHT = 34
const YEAR_AXIS_WIDTH = 72
const COLUMN_WIDTH = 190
const COLUMN_GAP = 18
const LANE_GAP = 8
const MAX_LANES_PER_COLUMN = 2
const TOP_PADDING = 24
const BOTTOM_PADDING = 56

export function setupChronologyTree({
  containerSelector,
  layoutSelector,
  chartSelector,
  sideTimelineSelector,
  getData,
  getActivePersonId,
  onPersonSelect
} = {}) {
  const state = {
    container: null,
    layout: null,
    chart: null,
    sideTimeline: null,
    mode: "tree",
    observer: null
  }

  const cacheDom = () => {
    state.container ||= document.querySelector(containerSelector)
    state.layout ||= document.querySelector(layoutSelector)
    state.chart ||= document.querySelector(chartSelector)
    state.sideTimeline ||= document.querySelector(sideTimelineSelector)
  }

  const showTree = () => {
    cacheDom()
    state.mode = "tree"
    state.chart?.classList.remove("is-hidden")
    state.container?.classList.add("is-hidden")
    state.layout?.classList.remove("is-chronology-mode")
    state.sideTimeline?.classList.remove("is-hidden")
  }

  const showChronology = () => {
    cacheDom()
    state.mode = "chronology"
    state.chart?.classList.add("is-hidden")
    state.container?.classList.remove("is-hidden")
    state.layout?.classList.add("is-chronology-mode")
    state.sideTimeline?.classList.add("is-hidden")
    update()
  }

  const update = () => {
    cacheDom()
    if (!state.container || state.mode !== "chronology") return

    const dataset = normalizeDataset(typeof getData === "function" ? getData() : [])
    const activePersonId = typeof getActivePersonId === "function" ? getActivePersonId() : null
    const activePerson = dataset.find(person => sameId(person.id, activePersonId)) || dataset[0]
    const viewModel = buildViewModel(dataset, activePerson)
    renderChronology(state.container, viewModel, onPersonSelect)
  }

  if (typeof ResizeObserver !== "undefined") {
    cacheDom()
    if (state.container) {
      state.observer = new ResizeObserver(update)
      state.observer.observe(state.container)
    }
  }

  window.addEventListener("resize", update, {passive: true})

  return {
    update,
    showTree,
    showChronology,
    isChronologyVisible: () => state.mode === "chronology",
    destroy() {
      window.removeEventListener("resize", update)
      state.observer?.disconnect()
    }
  }
}

function buildViewModel(dataset, activePerson) {
  if (!activePerson) {
    return {
      hasPeople: false,
      people: [],
      undatedPeople: [],
      startYear: new Date().getFullYear(),
      endYear: new Date().getFullYear() + 1,
      ticks: []
    }
  }

  const branch = collectActiveBranch(dataset, activePerson)
  const positionedPeople = inferBranchGenerations(
    branch.map(person => buildChronologyPerson(person, activePerson, dataset))
  )
  const datedPeople = positionedPeople.filter(person => person.birthYear)
  const undatedPeople = positionedPeople.filter(person => !person.birthYear)
  const currentYear = new Date().getFullYear()
  const minYear = datedPeople.length ? Math.min(...datedPeople.map(person => person.birthYear)) : currentYear
  const maxYear = datedPeople.length ? Math.max(...datedPeople.map(person => person.endYear)) : currentYear + 1
  const startYear = Math.floor((minYear - 5) / 10) * 10
  const endYear = Math.ceil((maxYear + 5) / 10) * 10
  const orderedPeople = assignColumns(datedPeople)
  const links = buildFamilyLinks(orderedPeople)
  const ticks = buildTicks(startYear, endYear)
  const minGeneration = orderedPeople.length ? Math.min(...orderedPeople.map(person => person.generation)) : 0

  return {
    hasPeople: !!branch.length,
    people: orderedPeople,
    undatedPeople,
    startYear,
    endYear,
    ticks,
    links,
    minGeneration,
    yearHeight: chooseYearHeight(startYear, endYear, orderedPeople.length),
    columnCount: getColumnCount(orderedPeople)
  }
}

function collectActiveBranch(dataset, activePerson) {
  const byId = buildPersonMap(dataset)
  const ids = new Set()
  const activeId = String(activePerson.id)

  const addAncestors = (person, depth = 0) => {
    if (!person || depth > 12) return
    addPerson(person)
    ;["father", "mother"].forEach(key => {
      const parent = byId.get(String(person.rels?.[key]))
      if (parent) addAncestors(parent, depth + 1)
    })
  }

  const addDescendants = (person, depth = 0) => {
    if (!person || depth > 12) return
    addPerson(person)
    ;(person.rels?.children || []).forEach(childId => {
      const child = byId.get(String(childId))
      if (child) addDescendants(child, depth + 1)
    })
  }

  const addPerson = (person) => {
    if (person?.id === undefined || person?.id === null) return
    ids.add(String(person.id))
    ;(person.rels?.spouses || []).forEach(spouseId => ids.add(String(spouseId)))
  }

  addAncestors(activePerson)
  addDescendants(activePerson)

  return Array.from(ids)
    .map(id => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      if (sameId(a.id, activeId)) return -1
      if (sameId(b.id, activeId)) return 1
      return getComparableYear(a) - getComparableYear(b)
    })
}

function buildChronologyPerson(person, activePerson, dataset) {
  const birthParts = parseDateParts(person.data?.birthday)
  const deathParts = parseDateParts(person.data?.lastday)
  const currentYear = new Date().getFullYear()
  const birthYear = birthParts ? Number(birthParts.year) : null
  const deathYear = deathParts ? Number(deathParts.year) : null
  const endYear = deathYear || currentYear
  const relationship = getRelationship(person, activePerson, dataset)
  const name = getPersonName(person)

  return {
    id: person.id,
    person,
    name,
    shortName: shortenName(name),
    avatar: resolveAvatar(person),
    gender: person.data?.gender,
    relationship,
    birthYear,
    deathYear,
    endYear: birthYear ? Math.max(endYear, birthYear + 1) : null,
    birthDate: birthParts ? formatDateParts(birthParts) : "",
    deathDate: deathParts ? formatDateParts(deathParts) : "",
    ageLabel: birthParts ? formatAge(birthParts, deathParts) : "Dates incomplètes",
    isActive: sameId(person.id, activePerson.id),
    generation: getGenerationOffset(person, activePerson, dataset)
  }
}

function assignColumns(people) {
  const columnOrder = ["ancestor", "active", "spouse", "descendant", "relative"]
  const minGeneration = people.length ? Math.min(...people.map(person => person.generation)) : 0
  const sortedPeople = [...people]
    .sort((a, b) => {
      const generationDelta = a.generation - b.generation
      if (generationDelta) return generationDelta
      const roleDelta = columnOrder.indexOf(a.relationship) - columnOrder.indexOf(b.relationship)
      if (roleDelta) return roleDelta
      return (a.birthYear || 0) - (b.birthYear || 0)
    })

  const groups = new Map()
  sortedPeople.forEach(person => {
    const baseColumn = person.generation - minGeneration
    if (!groups.has(baseColumn)) groups.set(baseColumn, [])
    groups.get(baseColumn).push(person)
  })

  const positioned = []
  Array.from(groups.keys()).sort((a, b) => a - b).forEach(baseColumn => {
    const group = groups.get(baseColumn)
    const lanes = []
    group
      .sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0))
      .forEach(person => {
        const laneIndex = findAvailableLane(lanes, person)
        lanes[laneIndex] = person.endYear + 4
        positioned.push({
          ...person,
          column: baseColumn,
          lane: laneIndex,
          laneCount: MAX_LANES_PER_COLUMN
        })
      })
  })

  return positioned
}

function inferBranchGenerations(people) {
  const peopleById = new Map(people.map(person => [String(person.id), person]))

  for (let pass = 0; pass < 6; pass += 1) {
    people.forEach(person => {
      ;(person.person?.rels?.spouses || []).forEach(spouseId => {
        const spouse = peopleById.get(String(spouseId))
        if (!spouse) return
        const canAnchorSpouse = person.isActive || person.generation !== 0 || spouse.generation === 0
        if (canAnchorSpouse && spouse.generation !== person.generation) {
          spouse.generation = person.generation
        }
        if (spouse.relationship === "relative") spouse.relationship = "spouse"
      })
    })
  }

  return people
}

function findAvailableLane(lanes, person) {
  const birthYear = person.birthYear || 0
  const laneIndex = lanes.findIndex(endYear => endYear <= birthYear)
  if (laneIndex !== -1) return laneIndex
  if (lanes.length < MAX_LANES_PER_COLUMN) return lanes.length
  return lanes.indexOf(Math.min(...lanes))
}

function renderChronology(container, model, onPersonSelect) {
  container.replaceChildren()

  const heading = document.createElement("div")
  heading.className = "chronology-tree__header"
  heading.innerHTML = `
    <div>
      <div class="chronology-tree__eyebrow">Branche active</div>
      <h2 class="chronology-tree__title">Frise de vie verticale</h2>
    </div>
    <div class="chronology-tree__legend" aria-label="Légende">
      <span><i class="chronology-tree__legend-dot chronology-tree__legend-dot--ancestor"></i>Ascendants</span>
      <span><i class="chronology-tree__legend-dot chronology-tree__legend-dot--active"></i>Profil actif</span>
      <span><i class="chronology-tree__legend-dot chronology-tree__legend-dot--descendant"></i>Descendants</span>
    </div>
  `
  container.appendChild(heading)

  if (!model.hasPeople) {
    const empty = document.createElement("div")
    empty.className = "chronology-tree__empty"
    empty.textContent = "Aucune personne à afficher."
    container.appendChild(empty)
    return
  }

  const totalHeight = TOP_PADDING + BOTTOM_PADDING + (model.endYear - model.startYear) * model.yearHeight
  const canvas = document.createElement("div")
  canvas.className = "chronology-tree__canvas"
  canvas.style.minHeight = `${totalHeight}px`
  canvas.style.setProperty("--chronology-total-height", `${totalHeight}px`)
  canvas.style.setProperty("--chronology-axis-width", `${YEAR_AXIS_WIDTH}px`)
  canvas.style.setProperty("--chronology-column-width", `${COLUMN_WIDTH}px`)
  canvas.style.setProperty("--chronology-column-gap", `${COLUMN_GAP}px`)
  canvas.style.width = `${YEAR_AXIS_WIDTH + model.columnCount * COLUMN_WIDTH + Math.max(model.columnCount - 1, 0) * COLUMN_GAP + 32}px`

  renderAxis(canvas, model)
  renderGenerationHeaders(canvas, model)
  renderFamilyLinks(canvas, model)
  renderLifeBars(canvas, model, onPersonSelect)
  container.appendChild(canvas)

  if (model.undatedPeople.length) {
    const undated = document.createElement("div")
    undated.className = "chronology-tree__undated"
    const title = document.createElement("div")
    title.className = "chronology-tree__undated-title"
    title.textContent = "Dates incomplètes"
    undated.appendChild(title)
    model.undatedPeople.slice(0, 8).forEach(person => {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "chronology-tree__undated-chip"
      chip.textContent = person.shortName
      chip.addEventListener("click", () => onPersonSelect?.(person.id))
      undated.appendChild(chip)
    })
    container.appendChild(undated)
  }
}

function renderAxis(canvas, model) {
  const axis = document.createElement("div")
  axis.className = "chronology-tree__axis"
  model.ticks.forEach(year => {
    const tick = document.createElement("div")
    tick.className = "chronology-tree__tick"
    tick.style.top = `${yearToY(year, model)}px`
    tick.innerHTML = `<span>${year}</span>`
    axis.appendChild(tick)
  })
  canvas.appendChild(axis)
}

function renderGenerationHeaders(canvas, model) {
  for (let column = 0; column < model.columnCount; column += 1) {
    const generation = model.minGeneration + column
    const label = document.createElement("div")
    label.className = "chronology-tree__generation"
    label.style.left = `${YEAR_AXIS_WIDTH + column * (COLUMN_WIDTH + COLUMN_GAP)}px`
    label.style.width = `${COLUMN_WIDTH}px`
    label.textContent = generation === 0
      ? "Profil actif"
      : `Génération ${generation > 0 ? "+" : ""}${generation}`
    canvas.appendChild(label)
  }
}

function renderLifeBars(canvas, model, onPersonSelect) {
  model.people.forEach(person => {
    const rect = getPersonRect(person, model)
    const bar = document.createElement("button")
    bar.type = "button"
    bar.className = `chronology-tree__person chronology-tree__person--${person.relationship}`
    if (person.isActive) bar.classList.add("is-active")
    if (person.gender === "F") bar.classList.add("is-female")
    if (person.gender === "M") bar.classList.add("is-male")
    bar.style.left = `${rect.x}px`
    bar.style.top = `${rect.y}px`
    bar.style.width = `${rect.width}px`
    bar.style.height = `${rect.height}px`
    bar.title = `${person.name}\n${person.birthDate || "Naissance inconnue"} - ${person.deathDate || "Aujourd'hui"}\n${person.ageLabel}`
    bar.addEventListener("click", () => onPersonSelect?.(person.id))
    bar.innerHTML = `
      <img class="chronology-tree__avatar" src="${escapeHtml(person.avatar)}" alt="" />
      <span class="chronology-tree__person-body">
        <span class="chronology-tree__person-name">${escapeHtml(person.shortName)}</span>
        <span class="chronology-tree__person-dates">${escapeHtml(formatLifeDates(person))}</span>
        <span class="chronology-tree__person-age">${escapeHtml(person.ageLabel)}</span>
      </span>
    `
    canvas.appendChild(bar)
  })
}

function renderFamilyLinks(canvas, model) {
  if (!model.links.length) return

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("class", "chronology-tree__links")
  svg.setAttribute("width", canvas.style.width || "100%")
  svg.setAttribute("height", `${TOP_PADDING + BOTTOM_PADDING + (model.endYear - model.startYear) * model.yearHeight}`)
  svg.setAttribute("aria-hidden", "true")

  model.links.forEach(link => {
    const from = model.people.find(person => sameId(person.id, link.from))
    const to = model.people.find(person => sameId(person.id, link.to))
    if (!from || !to) return

    const fromRect = getPersonRect(from, model)
    const toRect = getPersonRect(to, model)
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute("class", `chronology-tree__link chronology-tree__link--${link.type}`)
    path.setAttribute("d", link.type === "spouse"
      ? getSpousePath(fromRect, toRect)
      : getParentChildPath(fromRect, toRect))
    svg.appendChild(path)
  })

  canvas.appendChild(svg)
}

function getPersonRect(person, model) {
  const laneCount = Math.max(person.laneCount || 1, 1)
  const availableWidth = COLUMN_WIDTH - LANE_GAP * (laneCount - 1)
  const width = Math.floor(availableWidth / laneCount)
  const x = YEAR_AXIS_WIDTH + person.column * (COLUMN_WIDTH + COLUMN_GAP) + (person.lane || 0) * (width + LANE_GAP)
  const y = yearToY(person.birthYear, model)
  const height = Math.max((person.endYear - person.birthYear) * model.yearHeight, MIN_CARD_HEIGHT)
  return {x, y, width, height}
}

function getParentChildPath(parentRect, childRect) {
  const x1 = parentRect.x + parentRect.width / 2
  const y1 = parentRect.y + parentRect.height
  const x2 = childRect.x + childRect.width / 2
  const y2 = childRect.y
  const midY = y1 + Math.max((y2 - y1) * 0.45, 18)
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

function getSpousePath(firstRect, secondRect) {
  const y = Math.max(firstRect.y, secondRect.y) + 18
  const x1 = firstRect.x + firstRect.width
  const x2 = secondRect.x
  const startX = Math.min(x1, x2)
  const endX = Math.max(x1, x2)
  return `M ${startX} ${y} L ${endX} ${y}`
}

function yearToY(year, model) {
  return TOP_PADDING + (year - model.startYear) * model.yearHeight
}

function chooseYearHeight(startYear, endYear, peopleCount) {
  const years = Math.max(endYear - startYear, 1)
  const densityPenalty = peopleCount > 18 ? 1 : 0
  return Math.max(MIN_YEAR_HEIGHT, Math.min(MAX_YEAR_HEIGHT, 760 / years - densityPenalty))
}

function getColumnCount(people) {
  if (!people.length) return 1
  return Math.max(...people.map(person => person.column), 0) + 1
}

function buildFamilyLinks(people) {
  const visibleIds = new Set(people.map(person => String(person.id)))
  const links = []
  const seen = new Set()

  people.forEach(person => {
    ;["father", "mother"].forEach(key => {
      const parentId = person.person?.rels?.[key]
      if (!visibleIds.has(String(parentId))) return
      addLink(parentId, person.id, "parent")
    })

    ;(person.person?.rels?.spouses || []).forEach(spouseId => {
      if (!visibleIds.has(String(spouseId))) return
      const ids = [String(person.id), String(spouseId)].sort()
      addLink(ids[0], ids[1], "spouse")
    })
  })

  return links

  function addLink(from, to, type) {
    const key = `${type}:${from}:${to}`
    if (seen.has(key)) return
    seen.add(key)
    links.push({from, to, type})
  }
}

function buildTicks(startYear, endYear) {
  const ticks = []
  for (let year = startYear; year <= endYear; year += 10) {
    ticks.push(year)
  }
  return ticks
}

function getRelationship(person, activePerson, dataset) {
  if (sameId(person.id, activePerson.id)) return "active"
  if ((activePerson.rels?.spouses || []).some(id => sameId(id, person.id))) return "spouse"
  const generation = getGenerationOffset(person, activePerson, dataset)
  if (generation < 0) return "ancestor"
  if (generation > 0) return "descendant"
  return "relative"
}

function getGenerationOffset(person, activePerson, dataset) {
  if (sameId(person.id, activePerson.id)) return 0
  const down = findGenerationDistance(activePerson, person.id, dataset, "children")
  if (Number.isFinite(down)) return down
  const up = findAncestorDistance(activePerson, person.id, dataset)
  if (Number.isFinite(up)) return -up
  return 0
}

function findGenerationDistance(source, targetId, dataset, relationKey, depth = 0, visited = new Set()) {
  if (!source || depth > 12 || visited.has(String(source.id))) return Infinity
  visited.add(String(source.id))
  const ids = source.rels?.[relationKey] || []
  for (const id of ids) {
    if (sameId(id, targetId)) return depth + 1
    const child = dataset.find(candidate => sameId(candidate.id, id))
    const found = findGenerationDistance(child, targetId, dataset, relationKey, depth + 1, visited)
    if (Number.isFinite(found)) return found
  }
  return Infinity
}

function findAncestorDistance(source, targetId, dataset, depth = 0, visited = new Set()) {
  if (!source || depth > 12 || visited.has(String(source.id))) return Infinity
  visited.add(String(source.id))
  const parentIds = [source.rels?.father, source.rels?.mother].filter(Boolean)
  for (const id of parentIds) {
    if (sameId(id, targetId)) return depth + 1
    const parent = dataset.find(candidate => sameId(candidate.id, id))
    const found = findAncestorDistance(parent, targetId, dataset, depth + 1, visited)
    if (Number.isFinite(found)) return found
  }
  return Infinity
}

function normalizeDataset(dataset = []) {
  return Array.isArray(dataset) ? dataset.filter(Boolean) : []
}

function buildPersonMap(dataset) {
  return new Map(dataset.map(person => [String(person.id), person]))
}

function getComparableYear(person) {
  return parseDateParts(person?.data?.birthday)?.year || 9999
}

function getPersonName(person) {
  return [person.data?.["first name"], person.data?.["last name"]].filter(Boolean).join(" ").trim() || "Sans nom"
}

function shortenName(name) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length <= 3) return name
  return `${parts.slice(0, 2).join(" ")} ${parts.at(-1)}`
}

function resolveAvatar(person) {
  const avatar = person?.data?.avatar
  return avatar && avatar !== "null" ? avatar : DEFAULT_AVATAR
}

function formatLifeDates(person) {
  const start = person.birthDate || "?"
  const end = person.deathDate || "vivant"
  return `${start} - ${end}`
}

function formatAge(birthParts, deathParts) {
  const endDate = deathParts ? dateFromParts(deathParts) : new Date()
  const birthDate = dateFromParts(birthParts)
  let age = endDate.getFullYear() - birthDate.getFullYear()
  const hasHadBirthday = endDate.getMonth() > birthDate.getMonth()
    || (endDate.getMonth() === birthDate.getMonth() && endDate.getDate() >= birthDate.getDate())
  if (!hasHadBirthday) age -= 1
  return age >= 0 ? `${age} ans` : ""
}

function parseDateParts(value) {
  if (!value || typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized === "null") return null
  if (normalized.replace(/T.+$/, "").replace(/\s.+$/, "").replace(/\//g, "-") === PLACEHOLDER_DATE) return null

  let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/)
  if (match) {
    const [, year, month, day] = match
    return isValidDateParts(day, month, year) ? {day, month, year} : null
  }

  match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const [, rawDay, rawMonth, year] = match
    const day = rawDay.padStart(2, "0")
    const month = rawMonth.padStart(2, "0")
    return isValidDateParts(day, month, year) ? {day, month, year} : null
  }

  return null
}

function isValidDateParts(day, month, year) {
  const numericDay = Number(day)
  const numericMonth = Number(month)
  const numericYear = Number(year)
  if (!Number.isInteger(numericDay) || !Number.isInteger(numericMonth) || !Number.isInteger(numericYear)) return false
  if (numericYear < 1 || numericMonth < 1 || numericMonth > 12 || numericDay < 1) return false
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay))
  return date.getUTCFullYear() === numericYear
    && date.getUTCMonth() === numericMonth - 1
    && date.getUTCDate() === numericDay
}

function dateFromParts(parts) {
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
}

function formatDateParts(parts) {
  return `${parts.day}-${parts.month}-${parts.year}`
}

function sameId(left, right) {
  return String(left) === String(right)
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
