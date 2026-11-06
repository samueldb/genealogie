const DATE_FIELDS = ["birthday", "weddingday", "lastday"]
const PLACEHOLDER_FULL = "1970-01-01T00:00:00.000Z"
const VERTICAL_PADDING = 20
const COUNT_LINE_OFFSET = 30
const COUNT_LINE_PADDING = 8
const X_AXIS_GAP_BOTTOM = -15
const X_AXIS_TICK_SIZE = 4
const X_AXIS_TICK_COUNT = 4
const TICK_START_OFFSET = -15
const TICK_LENGTH = 10
const LABEL_GAP = 4

export function setupTimeline({containerSelector, chartSelector, getData, endYear = 2025} = {}) {
  const state = {container: null, svg: null, observer: null, chartObserver: null}

  const update = () => {
    cacheDom()
    if (!state.svg) return

    const chartHeight = getChartHeight()
    const panelWidth = getPanelWidth()
    if (!chartHeight || !panelWidth) {
      clearGroup(state.svg)
      return
    }

    state.svg.setAttribute("width", `${panelWidth}`)
    state.svg.setAttribute("height", `${chartHeight}`)
    state.svg.setAttribute("viewBox", `0 0 ${panelWidth} ${chartHeight}`)

    const dataset = typeof getData === "function" ? getData() : []
    const years = collectYears(dataset, endYear)
    const timelineGroup = ensureGroup(state.svg)

    if (!years.length || !timelineGroup) {
      clearGroup(timelineGroup)
      return
    }

    const startYear = Math.min(Math.floor(Math.min(...years) / 10) * 10, endYear)
    if (startYear > endYear) {
      clearGroup(timelineGroup)
      return
    }

    const availableHeight = Math.max(chartHeight - VERTICAL_PADDING * 2, 0)
    if (!availableHeight) {
      clearGroup(timelineGroup)
      return
    }

    const ticks = buildTicks(startYear, endYear)
    const scaleY = createScale(startYear, endYear, availableHeight)
    const decades = buildDecadeCounts(dataset, startYear, endYear)
    const {scaleX, maxCount} = createCountScale(decades, panelWidth)

    drawTimeline(timelineGroup, ticks, scaleY, availableHeight, decades, scaleX, maxCount)
  }

  const cacheDom = () => {
    if (!state.container && containerSelector) {
      state.container = document.querySelector(containerSelector)
    }
    if (state.container && !state.svg) {
      state.svg = state.container.querySelector("svg")
    }
  }

  const getPanelWidth = () => {
    if (!state.container) return 0
    const rect = state.container.getBoundingClientRect()
    return Math.max(rect.width, 0)
  }

  const getChartHeight = () => {
    const chart = chartSelector ? document.querySelector(chartSelector) : null
    const rect = chart?.getBoundingClientRect()
    if (rect && rect.height > 0) return rect.height
    const containerRect = state.container?.getBoundingClientRect()
    return containerRect?.height || 0
  }

  const observe = () => {
    if (typeof ResizeObserver !== "undefined") {
      cacheDom()
      if (state.svg && !state.observer) {
        state.observer = new ResizeObserver(update)
        state.observer.observe(state.svg)
      }
      if (chartSelector && !state.chartObserver) {
        const chart = document.querySelector(chartSelector)
        if (chart) {
          state.chartObserver = new ResizeObserver(update)
          state.chartObserver.observe(chart)
        }
      }
    }
  }

  window.addEventListener("resize", update, {passive: true})
  observe()

  return {
    update,
    destroy() {
      window.removeEventListener("resize", update)
      if (state.observer) state.observer.disconnect()
      if (state.chartObserver) state.chartObserver.disconnect()
    }
  }
}

function collectYears(items = [], endYear) {
  const years = []
  items.forEach(item => {
    const payload = getPayload(item)
    if (!payload) return
    DATE_FIELDS.forEach(field => {
      const value = payload[field]
      const year = extractYear(value)
      if (year) years.push(Math.min(year, endYear))
    })
  })
  return years
}

function getPayload(item) {
  if (!item) return null
  if (item.data && item.data.data) return item.data.data
  if (item.data) return item.data
  return item
}

function extractYear(raw) {
  if (!raw) return null
  if (raw === PLACEHOLDER_FULL) return null
  if (typeof raw === "number" && raw > 0) return raw
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isPlaceholderDate(trimmed)) return null
  const match = trimmed.match(/(\d{4})/)
  return match ? Number.parseInt(match[1], 10) : null
}

function isPlaceholderDate(value) {
  const normalized = value
    .replace(/T.+$/, "")
    .replace(/\s.+$/, "")
    .replace(/\//g, "-")
  return normalized === "1970-01-01"
}

function createScale(startYear, endYear, availableHeight) {
  if (startYear === endYear) {
    return () => VERTICAL_PADDING + availableHeight / 2
  }
  const domain = endYear - startYear
  return (year) => VERTICAL_PADDING + ((year - startYear) / domain) * availableHeight
}

function buildTicks(startYear, endYear) {
  const ticks = []
  for (let year = startYear; year <= endYear; year += 10) {
    ticks.push(year)
  }
  return ticks
}

function buildDecadeCounts(dataset = [], startYear, endYear) {
  const counts = []
  for (let year = startYear; year <= endYear; year += 10) {
    counts.push({year, value: countAliveInDecade(dataset, year, year + 9, endYear)})
  }
  return counts
}

function countAliveInDecade(dataset, start, end, endYear) {
  let count = 0
  dataset.forEach(person => {
    const life = getLifeRange(person)
    if (!life) return
    const {birthYear, deathYear} = life
    const death = typeof deathYear === "number" ? deathYear : endYear
    if (birthYear <= end && death >= start) count++
  })
  return count
}

function getLifeRange(person) {
  const payload = getPayload(person)
  if (!payload) return null
  const birthYear = extractYear(payload.birthday)
  if (!birthYear) return null
  const deathYear = extractYear(payload.lastday)
  return {birthYear, deathYear}
}

function createCountScale(decades, panelWidth) {
  const maxCount = Math.max(...decades.map(d => d.value), 0)
  const usableWidth = Math.max(panelWidth - COUNT_LINE_OFFSET - COUNT_LINE_PADDING, 20)
  const scaleX = !maxCount
    ? () => COUNT_LINE_OFFSET
    : (value) => COUNT_LINE_OFFSET + (value / maxCount) * usableWidth
  return {scaleX, maxCount}
}

function ensureGroup(svg) {
  if (!svg) return null
  let group = svg.querySelector(".timeline-plot")
  if (!group) {
    group = document.createElementNS("http://www.w3.org/2000/svg", "g")
    group.setAttribute("class", "timeline-plot")
    group.setAttribute("aria-hidden", "true")
    group.style.pointerEvents = "none"
    svg.appendChild(group)
  }
  return group
}

function clearGroup(group) {
  if (!group) return
  while (group.firstChild) group.removeChild(group.firstChild)
}

function drawTimeline(group, ticks, scaleY, availableHeight, decades, scaleX, maxCount) {
  clearGroup(group)

  const axisY = Math.max(
    VERTICAL_PADDING,
    VERTICAL_PADDING + availableHeight - (X_AXIS_GAP_BOTTOM + X_AXIS_TICK_SIZE)
  )
  const axisLine = document.createElementNS("http://www.w3.org/2000/svg", "line")
  axisLine.setAttribute("class", "timeline-x-axis-line")
  axisLine.setAttribute("x1", `${COUNT_LINE_OFFSET}`)
  axisLine.setAttribute("x2", `${scaleX(maxCount)}`)
  axisLine.setAttribute("y1", `${axisY}`)
  axisLine.setAttribute("y2", `${axisY}`)
  group.appendChild(axisLine)

  const countTicks = buildCountTicks(maxCount)
  countTicks.forEach(value => {
    const x = scaleX(value)
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line")
    tick.setAttribute("class", "timeline-x-axis-tick")
    tick.setAttribute("x1", `${x}`)
    tick.setAttribute("x2", `${x}`)
    tick.setAttribute("y1", `${axisY}`)
    tick.setAttribute("y2", `${axisY + X_AXIS_TICK_SIZE}`)
    group.appendChild(tick)

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text")
    label.setAttribute("class", "timeline-x-axis-label")
    label.setAttribute("x", `${x}`)
    label.setAttribute("y", `${axisY - 2}`)
    label.setAttribute("text-anchor", "middle")
    label.textContent = `${value}`
    group.appendChild(label)
  })
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
  line.setAttribute("class", "timeline-line")
  line.setAttribute("x1", "0")
  line.setAttribute("x2", "0")
  line.setAttribute("y1", `${VERTICAL_PADDING}`)
  line.setAttribute("y2", `${VERTICAL_PADDING + availableHeight}`)
  group.appendChild(line)

  const points = []

  ticks.forEach(year => {
    const y = scaleY(year)
    const tickGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
    tickGroup.setAttribute("class", "timeline-tick")
    tickGroup.setAttribute("transform", `translate(0, ${y})`)

    const tickLine = document.createElementNS("http://www.w3.org/2000/svg", "line")
    tickLine.setAttribute("class", "timeline-tick-line")
    tickLine.setAttribute("x1", `${TICK_START_OFFSET}`)
    tickLine.setAttribute("x2", `${TICK_START_OFFSET + TICK_LENGTH}`)
    tickLine.setAttribute("y1", "0")
    tickLine.setAttribute("y2", "0")

    const tickLabel = document.createElementNS("http://www.w3.org/2000/svg", "text")
    tickLabel.setAttribute("class", "timeline-tick-label")
    tickLabel.setAttribute("x", `${TICK_START_OFFSET + TICK_LENGTH + LABEL_GAP}`)
    tickLabel.setAttribute("y", "0")
    tickLabel.setAttribute("dominant-baseline", "middle")
    tickLabel.textContent = `${year}`

    tickGroup.appendChild(tickLine)
    tickGroup.appendChild(tickLabel)
    group.appendChild(tickGroup)

    const decade = decades.find(d => d.year === year)
    if (decade) points.push({x: scaleX(decade.value), y, count: decade.value})
  })

  if (points.length) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
    path.setAttribute("class", "timeline-count-path")
    path.setAttribute("d", d)
    group.appendChild(path)

    points.forEach(p => {
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      dot.setAttribute("class", "timeline-count-dot")
      dot.setAttribute("cx", `${p.x}`)
      dot.setAttribute("cy", `${p.y}`)
      dot.setAttribute("r", "2.5")
      dot.setAttribute("data-count", `${p.count}`)
      group.appendChild(dot)
    })
  }
}

function buildCountTicks(maxCount) {
  if (!maxCount) return [0]
  const step = Math.max(1, Math.ceil(maxCount / X_AXIS_TICK_COUNT))
  const ticks = []
  for (let value = 0; value <= maxCount; value += step) ticks.push(value)
  if (ticks[ticks.length - 1] !== maxCount) ticks.push(maxCount)
  return ticks
}
