import { setupTimeline } from "./timeline.js"
import { setupChronologyTree } from "./chronology-tree.js"

const FAMILY_CHART_SELECTOR = "#FamilyChart"
const FAMILY_CHART_BOTTOM_PADDING = 16
const TIMELINE_END_YEAR = 2025
const MOBILE_QUERY = "(max-width: 767px)"
const DESKTOP_CARD_SPACING = {x: 300, y: 150}
const MOBILE_CARD_SPACING = {x: 245, y: 118}

const isMobileLayout = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia(MOBILE_QUERY).matches
}

const resizeFamilyChartHeight = () => {
  const chart = document.querySelector(FAMILY_CHART_SELECTOR)
  if (!chart) return

  const { top } = chart.getBoundingClientRect()
  const viewportHeight = window.visualViewport?.height || window.innerHeight
  const bottomPadding = isMobileLayout() ? 12 : FAMILY_CHART_BOTTOM_PADDING
  const minimumHeight = isMobileLayout() ? 420 : 0
  const availableHeight = Math.max(minimumHeight, viewportHeight - top - bottomPadding)

  if (availableHeight > 0) {
    chart.style.height = `${availableHeight}px`
  }
}

const setupFamilyChartHeight = () => {
  const observerTargets = ["header", "content-wrapper"]
    .map(id => document.getElementById(id))
    .filter(Boolean)

  if (typeof ResizeObserver !== "undefined") {
    observerTargets.forEach(node => {
      const observer = new ResizeObserver(resizeFamilyChartHeight)
      observer.observe(node)
    })
  }

  window.addEventListener("resize", resizeFamilyChartHeight)
  window.addEventListener("orientationchange", resizeFamilyChartHeight)
  window.addEventListener("load", resizeFamilyChartHeight)

  resizeFamilyChartHeight()
}

setupFamilyChartHeight()
warmUpPersistenceBackend()

fetch("./data_db.json")
  .then(res => res.json())
  .then(data => create(data))
  .catch(err => console.error(err))

function warmUpPersistenceBackend() {
  const { healthEndpoint } = getPersistenceConfig()
  if (!healthEndpoint || typeof fetch !== "function") return

  fetch(healthEndpoint, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    keepalive: true
  }).catch(err => {
    console.debug("Backend warm-up failed", err)
  })
}

    function create(data){

      data = applyAvatarFallback(data)

      let lastNameSuggestions = extractLastNames(data)
      let saveTimeoutId = null
      let pendingSavePayload = null
      const saveStatusElement = document.getElementById("SaveDataStatus")
      let timeline = null
      let chronologyTree = null
      let currentPanelPersonId = null
      let mobileProfilePanel = null
      let currentChartSpacingMode = null

      const f3Chart = f3.createChart('#FamilyChart', data)
              .setTransitionTime(100)
              .setCardXSpacing(DESKTOP_CARD_SPACING.x)
              .setCardYSpacing(DESKTOP_CARD_SPACING.y)

      const initialMainId = 31
      const initialMainDatum = data.find(person => person.id === initialMainId)
      if (initialMainDatum) {
        f3Chart.updateMainId(initialMainDatum.id)
        currentPanelPersonId = initialMainDatum.id
      }

      const f3Card = f3Chart.setCardHtml()
        .setCardDisplay([
          d => `${truncateFirstWords(d.data["first name"])}`.trim() ,
          d => `${d.data["last name"]}`.trim(),
          d => formatDateLine("Naissance", d.data["birthday"]),
          //d => formatDateLine("Mariage", d.data["weddingday"]),
          d => formatDateLine("Décès", d.data["lastday"])
        ])
        .setOnCardClick(handleCardClick)

      const f3EditTree = f3Chart.editTree()
        .setFields([
          "first name",
          "last name",
          "birthday",
          { id: "weddingday", label: "Mariage", type: "text" },
          { id: "lastday", label: "Décès", type: "text" },
          { id: "avatar", label: "Photo URL", type: "text" },
          { id: "address", label: "Adresse", type: "text" },
          // { id: "geometry_lat", label: "Latitude", type: "text" },
          // { id: "geometry_lng", label: "Longitude", type: "text" },
          // { id: "geom", label: "Geom", type: "text" },
          { id: "commentaire", label: "Commentaire", type: "textarea" }
        ])
        .setEditFirst(false)  // true = open form on click, false = open info in click
        .setOnChange(() => {
               const updated_data = getCurrentDataset()
               lastNameSuggestions = extractLastNames(updated_data)
               queueDataPersistence()
               timeline?.update()
               chronologyTree?.update()
             })
        // .setNoEdit()  // if you want to just see info form
      setupEditPanel()
      mobileProfilePanel = setupMobileProfilePanel()
      setupResponsiveChartSpacing()

      timeline = setupTimeline({
        containerSelector: "#TimelineContainer",
        chartSelector: FAMILY_CHART_SELECTOR,
        getData: () => getCurrentDataset(),
        endYear: TIMELINE_END_YEAR
      })
      chronologyTree = setupChronologyTree({
        containerSelector: "#ChronologyTree",
        layoutSelector: ".timeline-layout",
        chartSelector: FAMILY_CHART_SELECTOR,
        sideTimelineSelector: "#TimelineContainer",
        getData: () => getCurrentDataset(),
        getActivePersonId: () => currentPanelPersonId || f3Chart.getMainDatum()?.id,
        onPersonSelect: personId => updateTreeWithNewMainPerson(personId, true)
      })
      setupTreeViewToggle(chronologyTree)

      if (typeof f3Chart.setAfterUpdate === "function") {
        f3Chart.setAfterUpdate(() => {
          timeline?.update()
          chronologyTree?.update()
        })
      }

      updateFamilyTree({initial: true})
      currentPanelPersonId = f3Chart.getMainDatum()?.id || currentPanelPersonId
      f3EditTree.open(f3Chart.getMainDatum())
      updateFamilyTree(initialMainDatum ? {tree_position: 'main_to_middle'} : {initial: true})
      mobileProfilePanel?.sync()
      timeline?.update()
      chronologyTree?.update()

      function handleCardClick(e, d) {
        const datum = d?.data || d
        if (!datum?.id) return

        const now = Date.now()
        const last = handleCardClick.lastClick || 0
        const isDouble = now - last < 300
        handleCardClick.lastClick = now

        if (isMobileLayout()) {
          updateTreeWithNewMainPerson(datum.id, true)
          mobileProfilePanel?.openPeek()
        } else if (isDouble) {
          updateTreeWithNewMainPerson(datum.id, true)
        } else {
          currentPanelPersonId = datum.id
          f3EditTree.open(datum)
          mobileProfilePanel?.sync()
          chronologyTree?.update()
        }
      }

      /*
      DROPDOWN SEARCH
       */
        // setup search dropdown
        // this is basic showcase, please use some autocomplete component and style it as you want

        const all_select_options = buildSearchOptions(data)
        setupSearchPanel(all_select_options)

        function buildSearchOptions(dataset) {
          const options = []
          dataset.forEach(d => {
            if (options.find(option => option.value === d.id)) return
            const birthDate = formatBirthDate(d.data["birthday"])
            const labelSuffix = birthDate ? `, né(e) le ${birthDate}` : ''
            options.push({
              label: `${d.data["first name"]} ${d.data["last name"]}${labelSuffix}`,
              value: d.id,
              searchable: `${d.data["first name"]} ${d.data["last name"]} ${birthDate}`.toLowerCase()
            })
          })
          return options.sort((a, b) => a.label.localeCompare(b.label))
        }

        function setupSearchPanel(options) {
          const container = document.getElementById("RecherchePersonne")
          if (!container) return

          container.innerHTML = `
            <div class="search-card">
              <div class="search-card__header">
                <span class="search-card__eyebrow">Navigation rapide</span>
                <div class="search-card__title">Rechercher une personne</div>
                <div class="search-card__subtitle">Prénom, nom ou date de naissance</div>
              </div>
              <label class="search-card__input-row" aria-label="Rechercher une personne">
                <span class="search-card__icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
                  </svg>
                </span>
                <input id="SearchPersonInput" type="text" placeholder="Ex: Antoine Deschamps" autocomplete="off" />
                <button type="button" class="search-card__clear" data-search-clear aria-label="Effacer la recherche">×</button>
              </label>
              <div class="search-card__meta">
                <span class="search-card__count" data-search-count></span>
                <span class="search-card__hint">Entrée pour zoomer sur la fiche</span>
              </div>
              <div id="SearchDropdown" class="search-card__dropdown" role="listbox"></div>
              <div class="search-card__empty is-hidden" data-search-empty>Aucun résultat</div>
            </div>
          `

          const input = container.querySelector("#SearchPersonInput")
          const dropdown = container.querySelector("#SearchDropdown")
          const count = container.querySelector("[data-search-count]")
          const emptyState = container.querySelector("[data-search-empty]")
          const clearButton = container.querySelector("[data-search-clear]")

          count.textContent = `${options.length} personnes`

          container.addEventListener("focusout", () => {
            setTimeout(() => {
              if (!container.contains(document.activeElement)) closeDropdown()
            }, 120)
          })

          input.addEventListener("focus", () => renderDropdown(input.value))
          input.addEventListener("input", (event) => renderDropdown(event.target.value))
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              const firstResult = dropdown.querySelector("[data-value]")
              if (firstResult) {
                updateTreeWithNewMainPerson(Number(firstResult.dataset.value), true)
                closeDropdown()
                input.blur()
              }
            } else if (event.key === "Escape") {
              closeDropdown()
            }
          })

          clearButton.addEventListener("click", () => {
            input.value = ""
            renderDropdown("")
            input.focus()
          })

          dropdown.addEventListener("wheel", (e) => e.stopPropagation())

          function renderDropdown(rawValue = "") {
            const query = rawValue.trim().toLowerCase()
            const hasQuery = !!query
            const filtered = hasQuery
              ? options.filter(option => option.searchable.includes(query))
              : options.slice(0, 20)

            dropdown.innerHTML = ""

            if (!filtered.length) {
              emptyState.classList.remove("is-hidden")
              count.textContent = "0 résultat"
              return
            }

            emptyState.classList.add("is-hidden")
            const countValue = hasQuery ? filtered.length : options.length
            count.textContent = `${countValue} résultat${countValue > 1 ? "s" : ""}`

            filtered.slice(0, 50).forEach(option => {
              const row = document.createElement("button")
              row.type = "button"
              row.className = "search-card__option"
              row.dataset.value = option.value
              row.setAttribute("role", "option")
              row.textContent = option.label
              row.addEventListener("click", () => {
                updateTreeWithNewMainPerson(option.value, true)
                closeDropdown()
              })
              dropdown.appendChild(row)
            })
          }

          function closeDropdown() {
            dropdown.innerHTML = ""
            emptyState.classList.add("is-hidden")
          }
        }

        function updateTreeWithNewMainPerson(personId, shouldCenter = false) {
          const target = getCurrentDataset().find(d => String(d.id) === String(personId))
          if (!target) {
            console.warn(`Impossible de trouver la personne ${personId}`)
            return
          }
          f3Chart.updateMainId(target.id)
          currentPanelPersonId = target.id
          const tree_position = shouldCenter || isMobileLayout() ? 'main_to_middle' : 'inherit'
          if (!chronologyTree?.isChronologyVisible()) {
            updateFamilyTree({tree_position})
          }
          const currentMain = f3Chart.getMainDatum()
          if (currentMain) f3EditTree.open(currentMain)
          mobileProfilePanel?.openPeek()
          chronologyTree?.update()
        }

        function updateFamilyTree(props = {}) {
          const restoreMobileDescendants = limitMobileDescendantsForRender()
          try {
            f3Chart.updateTree(props)
          } finally {
            restoreMobileDescendants?.()
          }
        }

        function limitMobileDescendantsForRender() {
          if (!isMobileLayout()) return null

          const mainPersonId = currentPanelPersonId || f3Chart.getMainDatum()?.id
          if (mainPersonId === undefined || mainPersonId === null) return null

          const changedProfiles = []
          const mainId = String(mainPersonId)
          const dataset = f3Chart.store?.getData?.() || []

          dataset.forEach(person => {
            if (!person?.rels?.children?.length || String(person.id) === mainId) return
            changedProfiles.push([person, person.rels.children])
            person.rels.children = []
          })

          return () => {
            changedProfiles.forEach(([person, children]) => {
              person.rels.children = children
            })
          }
        }

        function setupResponsiveChartSpacing() {
          const applySpacing = ({update = false} = {}) => {
            const mobile = isMobileLayout()
            const nextMode = mobile ? "mobile" : "desktop"
            if (currentChartSpacingMode === nextMode) return
            currentChartSpacingMode = nextMode
            const spacing = mobile ? MOBILE_CARD_SPACING : DESKTOP_CARD_SPACING
            f3Chart.setCardXSpacing(spacing.x)
            f3Chart.setCardYSpacing(spacing.y)
            if (mobile && chronologyTree?.isChronologyVisible()) {
              chronologyTree.showTree()
            }
            if (update && !chronologyTree?.isChronologyVisible()) {
              updateFamilyTree({tree_position: "main_to_middle"})
            }
            resizeFamilyChartHeight()
            mobileProfilePanel?.sync()
          }

          applySpacing()

          if (typeof window.matchMedia === "function") {
            const mediaQuery = window.matchMedia(MOBILE_QUERY)
            const onChange = () => applySpacing({update: true})
            if (typeof mediaQuery.addEventListener === "function") {
              mediaQuery.addEventListener("change", onChange)
            } else if (typeof mediaQuery.addListener === "function") {
              mediaQuery.addListener(onChange)
            }
          }

          window.addEventListener("orientationchange", () => {
            window.setTimeout(() => applySpacing({update: true}), 160)
          })
        }

        function setupMobileProfilePanel() {
          const editPanel = document.getElementById("EditPanel")
          if (!editPanel) return null

          editPanel.classList.add("mobile-profile")
          editPanel.dataset.mobileProfileState = "collapsed"

          let handle = editPanel.querySelector(".mobile-profile__handle")
          if (!handle) {
            handle = document.createElement("button")
            handle.type = "button"
            handle.className = "mobile-profile__handle"
            handle.setAttribute("aria-label", "Ouvrir ou réduire le profil")
            handle.innerHTML = `<span class="mobile-profile__handle-bar" aria-hidden="true"></span>`
            editPanel.prepend(handle)
          }

          let summary = editPanel.querySelector(".mobile-profile__summary")
          if (!summary) {
            summary = document.createElement("div")
            summary.className = "mobile-profile__summary"
            summary.innerHTML = `
              <button type="button" class="mobile-profile__summary-main" aria-label="Ouvrir le profil">
                <span class="mobile-profile__summary-name">Profil</span>
                <span class="mobile-profile__summary-meta">Sélectionnez une personne</span>
              </button>
              <button type="button" class="mobile-profile__summary-action" aria-label="Afficher le profil complet">Voir</button>
            `
            handle.after(summary)
          }

          const setState = (state) => {
            const normalizedState = isMobileLayout() ? state : "desktop"
            editPanel.dataset.mobileProfileState = normalizedState
            document.body.dataset.mobileProfileState = normalizedState
            resizeFamilyChartHeight()
          }

          const getState = () => editPanel.dataset.mobileProfileState || "collapsed"
          const openPeek = () => setState("peek")
          const openExpanded = () => setState("expanded")
          const collapse = () => setState("collapsed")

          const toggleFromHandle = () => {
            if (!isMobileLayout()) return
            const state = getState()
            if (state === "collapsed") openPeek()
            else if (state === "peek") openExpanded()
            else collapse()
          }

          handle.addEventListener("click", toggleFromHandle)
          summary.querySelector(".mobile-profile__summary-main")?.addEventListener("click", openPeek)
          summary.querySelector(".mobile-profile__summary-action")?.addEventListener("click", openExpanded)

          const sync = () => {
            const person = getCurrentPanelPerson()
            const nameEl = summary.querySelector(".mobile-profile__summary-name")
            const metaEl = summary.querySelector(".mobile-profile__summary-meta")
            const name = person ? getPersonDisplayName(person) : "Profil"
            const age = person ? formatAgeForPanel(person.data?.birthday, person.data?.lastday) : ""
            setTextContentIfChanged(nameEl, name)
            setTextContentIfChanged(metaEl, age || "Sélectionnez une personne")

            const form = editPanel.querySelector("form")
            const isEditing = !!form && !form.classList.contains("non-editable")
            editPanel.classList.toggle("is-editing", isMobileLayout() && isEditing)
            if (isMobileLayout() && isEditing && getState() !== "expanded") {
              openExpanded()
            } else if (isMobileLayout() && getState() === "desktop") {
              collapse()
            } else if (!isMobileLayout()) {
              setState("desktop")
            }
          }

          window.addEventListener("resize", sync)
          window.addEventListener("orientationchange", sync)
          sync()

          return {sync, openPeek, openExpanded, collapse}
        }

        function setupTreeViewToggle(chronology) {
          const buttons = Array.from(document.querySelectorAll("[data-tree-view]"))
          if (!buttons.length || !chronology) return

          buttons.forEach(button => {
            if (button.dataset.viewToggleAttached === "true") return
            button.dataset.viewToggleAttached = "true"
            button.setAttribute("aria-pressed", String(button.classList.contains("is-active")))
            button.addEventListener("click", () => {
              const view = button.dataset.treeView
              buttons.forEach(candidate => {
                const isActive = candidate === button
                candidate.classList.toggle("is-active", isActive)
                candidate.setAttribute("aria-pressed", String(isActive))
              })

              if (view === "chronology") {
                chronology.showChronology()
              } else {
                chronology.showTree()
                resizeFamilyChartHeight()
                updateFamilyTree({tree_position: "main_to_middle"})
                timeline?.update()
              }
            })
          })
        }

        function setupEditPanel() {
          const editPanelWrapper = document.getElementById("EditPanelFormHost") || document.getElementById("EditPanel") || document.getElementById("sidebar")
          const currentFormCont = document.querySelector("#FamilyChart .f3-form-cont")
          if (editPanelWrapper && currentFormCont) {
            editPanelWrapper.prepend(currentFormCont)
            f3EditTree.form_cont = currentFormCont
            f3EditTree.fixed()
            initLastNameAutocomplete(editPanelWrapper)
            hookPersonFormEnhancer(currentFormCont)
            hookSearchMasking(currentFormCont)
          }
        }

        function hookPersonFormEnhancer(formCont) {
          if (!formCont || formCont.dataset.formEnhancerAttached === "true") return
          formCont.dataset.formEnhancerAttached = "true"
          let enhancementFrame = null
          const observer = new MutationObserver(() => {
            if (enhancementFrame) return
            enhancementFrame = window.requestAnimationFrame(() => {
              enhancementFrame = null
              enhancePersonForm(formCont)
            })
          })
          observer.observe(formCont, {childList: true, subtree: true})
          enhancePersonForm(formCont)
        }

        function hookSearchMasking(formCont) {
          const searchContainer = document.getElementById("RecherchePersonne")
          if (!searchContainer) return
          const updateMask = () => {
            const hasOpenForm = formCont.classList.contains("opened") && !!formCont.querySelector("form")
            searchContainer.classList.toggle("is-masked", hasOpenForm)
          }
          const observer = new MutationObserver(updateMask)
          observer.observe(formCont, {attributes: true, attributeFilter: ["class"], childList: true})
          updateMask()
        }

        function enhancePersonForm(formHost) {
          const form = (formHost || document).querySelector("form")
          if (!form) return
          enhanceAvatarField(formHost)
          structurePersonPanelActions(formHost)
          enhanceDateInputs(formHost)
          enhanceInfoReadability(formHost)
          enhanceLifeTimeline(formHost)
          enhanceMapField(formHost)
          mobileProfilePanel?.sync()
        }

        function enhanceAvatarField(formHost) {
          const avatarInput = formHost.querySelector('input[name="avatar"]')
          const infoFieldWrapper = getInfoFieldByLabel(formHost, "Photo URL")
          const fieldWrapper = avatarInput?.closest('.f3-form-field') || infoFieldWrapper
          if (!fieldWrapper || fieldWrapper.dataset.enhanced === "true") return

          fieldWrapper.dataset.enhanced = "true"

          const mediaWrapper = document.createElement("div")
          mediaWrapper.className = "person-media"
          mediaWrapper.innerHTML = `
            <div class="person-media__preview">
              <img src="${getAvatarValue() || "deschampsberger/images/profil_court.png"}" alt="Portrait" />
            </div>
            <div class="person-media__actions">
              ${avatarInput ? `
                <label class="person-media__upload">
                  <input type="file" accept="image/*" class="person-media__file" />
                  <span>Importer une photo</span>
                </label>
                <span class="person-media__hint">ou coller une URL</span>
              ` : ``}
            </div>
          `

          if (avatarInput) {
            const labelEl = fieldWrapper.querySelector("label")
            if (labelEl) labelEl.classList.add("visually-hidden")
            avatarInput.placeholder = "URL de la photo"
            avatarInput.addEventListener("input", () => updatePreview(avatarInput.value))

            mediaWrapper.querySelector(".person-media__file").addEventListener("change", event => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const dataUrl = reader.result
                avatarInput.value = typeof dataUrl === "string" ? dataUrl : ""
                updatePreview(avatarInput.value)
                avatarInput.dispatchEvent(new Event("input", {bubbles: true}))
                avatarInput.dispatchEvent(new Event("change", {bubbles: true}))
              }
              reader.readAsDataURL(file)
            })
          }

          const infoValue = infoFieldWrapper?.querySelector(".f3-info-field-value")
          if (infoValue) infoValue.classList.add("visually-hidden")

          moveKeyFieldsToHeader(formHost, mediaWrapper, fieldWrapper)

          function getAvatarValue() {
            if (avatarInput) return avatarInput.value
            const infoValue = infoFieldWrapper?.querySelector(".f3-info-field-value")?.textContent?.trim()
            return infoValue || ""
          }

          function updatePreview(url) {
            const img = mediaWrapper.querySelector("img")
            img.src = url || "deschampsberger/images/profil_base.svg"
          }
        }

        function enhanceDateInputs(formHost) {
          const dateFieldNames = ["birthday", "weddingday", "lastday"]
          dateFieldNames.forEach(name => {
            const input = formHost.querySelector(`input[name="${name}"]`)
            if (!input || input.dataset.dateEnhanced === "true") return

            input.dataset.dateEnhanced = "true"
            input.type = "text"
            input.placeholder = "jj/mm/aaaa"
            input.inputMode = "numeric"
            input.setAttribute("pattern", "\\d{2}/\\d{2}/\\d{4}")

            const formattedValue = formatDateForEditInput(input.value)
            if (formattedValue) input.value = formattedValue

            const fieldWrapper = input.closest(".f3-form-field") || input.parentElement
            if (!fieldWrapper) return

            let datePicker = fieldWrapper.querySelector(".person-date-picker")
            if (!datePicker) {
              datePicker = document.createElement("input")
              datePicker.type = "date"
              datePicker.className = "person-date-picker"
              datePicker.setAttribute("aria-label", "Sélectionner une date")
              input.after(datePicker)
            }

            datePicker.value = toCalendarDateValue(input.value)
            datePicker.addEventListener("change", () => {
              const selectedDate = formatCalendarDateForEditInput(datePicker.value)
              if (!selectedDate) return
              input.value = selectedDate
              input.dispatchEvent(new Event("input", {bubbles: true}))
              input.dispatchEvent(new Event("change", {bubbles: true}))
            })

            input.addEventListener("change", () => {
              datePicker.value = toCalendarDateValue(input.value)
            })
            input.addEventListener("blur", () => {
              const normalized = formatDateForEditInput(input.value)
              if (normalized) input.value = normalized
              datePicker.value = toCalendarDateValue(input.value)
            })
          })
        }

        function getInfoFieldByLabel(form, ...labelTexts) {
          const normalizedTargets = labelTexts
            .filter(Boolean)
            .map(text => text.trim().toLowerCase())

          if (!normalizedTargets.length) return null

          const infoFields = form.querySelectorAll(".f3-info-field")
          return Array.from(infoFields).find(field => {
            const label = field.querySelector(".f3-info-field-label")?.textContent?.trim().toLowerCase()
            return label && normalizedTargets.includes(label)
          })
        }

        function moveKeyFieldsToHeader(formHost, mediaWrapper, avatarFieldWrapper) {
          const form = formHost.querySelector("#familyForm")
          if (!form) return

          let header = form.querySelector(".person-form-header")
          let avatarSlot = form.querySelector(".person-form-header__avatar")
          let detailsSlot = form.querySelector(".person-form-header__details")

          if (!header) {
            header = document.createElement("div")
            header.className = "person-form-header"
            avatarSlot = document.createElement("div")
            avatarSlot.className = "person-form-header__avatar"
            detailsSlot = document.createElement("div")
            detailsSlot.className = "person-form-header__details"
            header.appendChild(avatarSlot)
            header.appendChild(detailsSlot)
            const insertBeforeEl = form.querySelector(".f3-radio-group") || form.querySelector(".f3-form-field") || form.querySelector(".f3-info-field") || form.firstChild
            form.insertBefore(header, insertBeforeEl)
          }

          if (mediaWrapper && mediaWrapper.parentElement !== avatarSlot) {
            avatarSlot.appendChild(mediaWrapper)
          }

          if (avatarFieldWrapper && avatarFieldWrapper.parentElement !== avatarSlot) {
            avatarSlot.appendChild(avatarFieldWrapper)
          }
          if (avatarFieldWrapper) avatarFieldWrapper.classList.add("avatar-field-wrapper")

          const lastNameWrapper = findFieldWrapper(formHost, 'last name', 'Nom de famille')
          const firstNameWrapper = findFieldWrapper(formHost, 'first name', 'Prénom')
          const birthdayWrapper = findFieldWrapper(formHost, 'birthday', 'Date de naissance', 'Birthday')
          ;[lastNameWrapper, firstNameWrapper, birthdayWrapper].forEach(wrapper => {
            if (wrapper && wrapper.parentElement !== detailsSlot) detailsSlot.appendChild(wrapper)
          })
          applyFrenchFieldLabels(lastNameWrapper, firstNameWrapper, birthdayWrapper)

          function findFieldWrapper(scope, name, labelText) {
            const input = scope.querySelector(`input[name="${name}"]`)
            if (input) return input.closest('.f3-form-field')
            return getInfoFieldByLabel(scope, labelText, name) || null
          }
        }

        function applyFrenchFieldLabels(lastNameWrapper, firstNameWrapper, birthdayWrapper) {
          ;[
            [lastNameWrapper, "Nom de famille"],
            [firstNameWrapper, "Prénom"],
            [birthdayWrapper, "Date de naissance"]
          ].forEach(([wrapper, label]) => {
            const labelEl = wrapper?.querySelector("label, .f3-info-field-label")
            if (labelEl) labelEl.textContent = label
          })
        }

        function enhanceMapField(formHost) {
          let latInput = formHost.querySelector('input[name="geometry_lat"]')
          let lngInput = formHost.querySelector('input[name="geometry_lng"]')
          const latInfo = getInfoFieldByLabel(formHost, "Latitude")
          const lngInfo = getInfoFieldByLabel(formHost, "Longitude")
          const addressInput = formHost.querySelector('input[name="address"]')
          const addressInfo = getInfoFieldByLabel(formHost, "Adresse", "address")
          let latValue = resolveNumericValue(latInput?.value, latInfo)
          let lngValue = resolveNumericValue(lngInput?.value, lngInfo)
          const addressValue = normalizeOptionalText(resolveTextValue(addressInput?.value, addressInfo))

          const editable = !!latInput && !!lngInput && !formHost.querySelector("form")?.classList.contains("non-editable")
          const existingWrapper = formHost.querySelector(".person-map")
          const hasLocation = (Number.isFinite(latValue) && Number.isFinite(lngValue)) || !!addressValue
          if (!hasLocation) {
            if (existingWrapper) existingWrapper.remove()
            return
          }
          if (existingWrapper && existingWrapper.dataset.editable === String(editable)) {
            return
          }
          if (existingWrapper) existingWrapper.remove()

          const referenceField = (lngInput && lngInput.closest('.f3-form-field'))
            || (latInput && latInput.closest('.f3-form-field'))
            || formHost.querySelector('.f3-form-buttons')

          const mapWrapper = document.createElement("div")
          mapWrapper.className = "person-map"
          mapWrapper.dataset.editable = String(editable)

          const header = document.createElement("div")
          header.className = "person-map__header"
          header.innerHTML = `<div class="person-map__title">Localisation</div>`
          if (editable) {
            const subtitle = document.createElement("div")
            subtitle.className = "person-map__subtitle"
            subtitle.textContent = "Déplacez le point ou modifiez les coordonnées"
            header.appendChild(subtitle)
          }

          const mapCanvas = document.createElement("div")
          mapCanvas.className = "person-map__canvas"
          mapCanvas.style.position = "relative"
          mapCanvas.style.width = "100%"

          const footer = document.createElement("div")
          footer.className = "person-map__footer"
          if (editable) {
            const hint = document.createElement("span")
            hint.className = "person-map__hint"
            hint.textContent = "Ajustez la position pour refléter la bonne adresse"
            footer.appendChild(hint)
          }

          mapWrapper.appendChild(header)
          mapWrapper.appendChild(mapCanvas)
          mapWrapper.appendChild(footer)

          if (referenceField) referenceField.after(mapWrapper)
          else formHost.appendChild(mapWrapper)

          if (typeof maplibregl === "undefined") {
            mapWrapper.querySelector(".person-map__canvas").textContent = "Carte indisponible ( MapLibre non chargé )"
            return
          }

          ensureCoordinateInputs()

          let map = null
          let marker = null

          const createMapIfNeeded = (lat, lng) => {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
            clearStatus()
            if (!map) {
              map = new maplibregl.Map({
                container: mapCanvas,
                style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
                center: [lng, lat],
                zoom: 12,
                dragPan: editable,
                dragRotate: false,
                scrollZoom: false,
                pitchWithRotate: false,
                doubleClickZoom: editable
              })

              map.addControl(new maplibregl.NavigationControl({visualizePitch: false}), "top-right")

              marker = new maplibregl.Marker({draggable: editable})
                .setLngLat([lng, lat])
                .addTo(map)
              scheduleResize()

              map.on("load", () => {
                clearStatus()
                scheduleResize()
              })

              map.on("error", (e) => {
                console.warn("MapLibre error", e && e.error)
                setStatus("Carte indisponible pour le moment.")
              })

              const resizeObserver = new ResizeObserver(scheduleResize)
              resizeObserver.observe(mapCanvas)

              marker.on("dragend", () => {
                const {lat: newLat, lng: newLng} = marker.getLngLat()
                latInput.value = newLat.toFixed(6)
                lngInput.value = newLng.toFixed(6)
              })
            } else if (marker) {
              marker.setLngLat([lng, lat])
              map.setCenter([lng, lat])
            }
          }

          const applyCoords = (lat, lng) => {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
            clearStatus()
            latInput.value = lat.toFixed(6)
            lngInput.value = lng.toFixed(6)
            latValue = lat
            lngValue = lng
            createMapIfNeeded(lat, lng)
          }

          const syncMarkerToInputs = () => {
            const newLat = parseFloat(latInput.value)
            const newLng = parseFloat(lngInput.value)
            if (!Number.isFinite(newLat) || !Number.isFinite(newLng)) return
            createMapIfNeeded(newLat, newLng)
          }

          const geocodeAndApply = debounce(async (query) => {
            if (!query) return
            const result = await geocodeAddress(query)
            if (result) applyCoords(result.lat, result.lng)
          }, 400)

          let hasRenderedSomething = false

          if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
            createMapIfNeeded(latValue, lngValue)
            hasRenderedSomething = true
          } else if (addressValue) {
            setStatus("Recherche de l'adresse…")
            geocodeAddress(addressValue).then(result => {
              if (result) {
                applyCoords(result.lat, result.lng)
              } else {
                setStatus("Adresse introuvable. Ajoutez des coordonnées ou une adresse valide.")
              }
            })
            hasRenderedSomething = true
          }

          latInput.addEventListener("change", syncMarkerToInputs)
          lngInput.addEventListener("change", syncMarkerToInputs)
          latInput.addEventListener("blur", syncMarkerToInputs)
          lngInput.addEventListener("blur", syncMarkerToInputs)

          if (addressInput) {
            const triggerGeocode = () => geocodeAndApply(addressInput.value.trim())
            addressInput.addEventListener("change", triggerGeocode)
            addressInput.addEventListener("blur", triggerGeocode)
            addressInput.addEventListener("input", triggerGeocode)
          }

          function ensureCoordinateInputs() {
            if (latInput && lngInput) return
            const form = formHost.querySelector("form")
            if (!form) return
            if (!latInput) {
              latInput = document.createElement("input")
              latInput.type = "hidden"
              latInput.name = "geometry_lat"
              if (Number.isFinite(latValue)) latInput.value = latValue
              form.appendChild(latInput)
            }
            if (!lngInput) {
              lngInput = document.createElement("input")
              lngInput.type = "hidden"
              lngInput.name = "geometry_lng"
              if (Number.isFinite(lngValue)) lngInput.value = lngValue
              form.appendChild(lngInput)
            }
          }

          function setStatus(text) {
            mapCanvas.textContent = text
          }

          function clearStatus() {
            if (mapCanvas.firstChild && mapCanvas.childNodes.length === 1 && mapCanvas.firstChild.nodeType === Node.TEXT_NODE) {
              mapCanvas.textContent = ""
            }
          }

          function scheduleResize() {
            if (!map) return
            requestAnimationFrame(() => {
              try { map.resize() } catch (err) {}
            })
            setTimeout(() => {
              try { map.resize() } catch (err) {}
            }, 200)
          }
        }

        function structurePersonPanelActions(formHost) {
          const form = formHost.querySelector("form")
          if (!form) return

          let toolbar = form.querySelector(".person-panel-actions")
          if (!toolbar) {
            toolbar = document.createElement("div")
            toolbar.className = "person-panel-actions"
            const title = form.querySelector(".f3-form-title")
            const insertBeforeEl = title?.nextSibling || form.firstChild
            form.insertBefore(toolbar, insertBeforeEl)
          }

          const editBtn = form.querySelector(".f3-edit-btn")
          const addRelativeBtn = form.querySelector(".f3-add-relative-btn")
          const closeBtn = form.querySelector(".f3-close-btn")

          ;[
            [addRelativeBtn, "Ajouter un proche"],
            [editBtn, "Modifier la personne"],
            [closeBtn, "Fermer le panneau"]
          ].forEach(([button, label]) => {
            if (!button) return
            button.classList.add("panel-icon-button")
            if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", label)
            if (!button.getAttribute("title")) button.setAttribute("title", label)
            if (button.parentElement !== toolbar) toolbar.appendChild(button)
          })

          if (addRelativeBtn && addRelativeBtn.dataset.centerOnAddAttached !== "true") {
            addRelativeBtn.dataset.centerOnAddAttached = "true"
            addRelativeBtn.addEventListener("click", centerCurrentPanelPersonForAddRelative, {capture: true})
          }

          const sourceButtons = form.querySelector(".f3-form-buttons")
          if (sourceButtons && sourceButtons !== toolbar && !sourceButtons.children.length) {
            sourceButtons.classList.add("is-empty")
          }
        }

        function centerCurrentPanelPersonForAddRelative() {
          const person = getCurrentPanelPerson()
          if (!person?.id) return
          currentPanelPersonId = person.id
          f3Chart.updateMainId(person.id)
          updateFamilyTree({tree_position: "main_to_middle"})
        }

        function enhanceInfoReadability(formHost) {
          const form = formHost.querySelector("form")
          if (!form) return

          let detailsGrid = form.querySelector(".person-details-grid")
          if (!detailsGrid) {
            detailsGrid = document.createElement("div")
            detailsGrid.className = "person-details-grid"
            const insertAfter = form.querySelector(".person-form-header") || form.querySelector(".f3-form-title")
            if (insertAfter?.nextSibling) {
              form.insertBefore(detailsGrid, insertAfter.nextSibling)
            } else {
              form.appendChild(detailsGrid)
            }
          }

          const header = form.querySelector(".person-form-header")
          Array.from(form.querySelectorAll(".f3-info-field")).forEach(field => {
            const label = field.querySelector(".f3-info-field-label")?.textContent?.trim()
            const valueEl = field.querySelector(".f3-info-field-value")
            if (!valueEl) return

            const originalLabel = field.dataset.originalLabel || label || ""
            if (!field.dataset.originalLabel) field.dataset.originalLabel = originalLabel
            const rawValue = valueEl.dataset.originalValue ?? valueEl.textContent ?? ""
            if (!valueEl.dataset.originalValue) valueEl.dataset.originalValue = rawValue
            if (isTimelineOnlyDateLabel(originalLabel)) {
              field.remove()
              return
            }
            const isDateField = isDateFieldLabel(originalLabel)
            const value = rawValue.trim()
            const displayValue = isBirthDateLabel(originalLabel)
              ? formatAgeForPanel(value, getLifeDateValue(getCurrentPanelPerson(), formHost, "lastday"))
              : isDateField ? formatDateForPanel(value) : value

            field.classList.add("person-detail-field")
            field.classList.toggle("is-empty", !value)

            setTextContentIfChanged(valueEl, displayValue || "Non renseigné")
            if (isBirthDateLabel(originalLabel)) {
              const labelEl = field.querySelector(".f3-info-field-label")
              if (labelEl) setTextContentIfChanged(labelEl, "Âge")
            }

            const isKeyHeaderField = header?.contains(field)
            const isHiddenMediaField = field.classList.contains("avatar-field-wrapper")
              || label === "Photo URL"
              || valueEl.classList.contains("visually-hidden")

            if (!isKeyHeaderField && !isHiddenMediaField && field.parentElement !== detailsGrid) {
              detailsGrid.appendChild(field)
            }

            if (/commentaire|adresse/i.test(label || "")) {
              field.classList.add("person-detail-field--wide")
            }
          })

          detailsGrid.classList.toggle("is-empty", !detailsGrid.querySelector(".person-detail-field:not(.is-empty)"))
        }

        function enhanceLifeTimeline(formHost) {
          const form = formHost.querySelector("form")
          if (!form) return

          const person = getCurrentPanelPerson()
          const timelineData = buildLifeTimelineData(person, formHost)
          let timelineEl = form.querySelector(".person-life-timeline")

          if (!timelineData.hasKnownDate) {
            if (timelineEl) timelineEl.remove()
            return
          }

          if (!timelineEl) {
            timelineEl = document.createElement("section")
            timelineEl.className = "person-life-timeline"
            const header = form.querySelector(".person-form-header")
            if (header?.nextSibling) form.insertBefore(timelineEl, header.nextSibling)
            else form.insertBefore(timelineEl, form.firstChild)
          }

          const timelineSignature = JSON.stringify(timelineData.items.map(item => ({
            type: item.type,
            label: item.label,
            date: item.date,
            position: Math.round(item.position * 10) / 10,
            stackLevel: item.stackLevel || 0,
            tooltip: item.tooltip || ""
          })))
          if (timelineEl.dataset.timelineSignature === timelineSignature) return
          timelineEl.dataset.timelineSignature = timelineSignature

          timelineEl.replaceChildren()
          const axis = document.createElement("div")
          axis.className = "person-life-timeline__axis"

          timelineData.items.forEach(item => {
            const node = document.createElement("div")
            node.className = `person-life-timeline__item person-life-timeline__item--${item.type}`
            if (!item.date) node.classList.add("is-empty")
            if (item.lane) node.classList.add(`person-life-timeline__item--lane-${item.lane}`)
            if (item.stackLevel) node.classList.add(`person-life-timeline__item--stack-${item.stackLevel}`)
            node.style.setProperty("--timeline-position", `${item.position}%`)
            node.tabIndex = 0

            const label = document.createElement("div")
            label.className = "person-life-timeline__label"
            label.textContent = item.label

            const marker = document.createElement("div")
            marker.className = "person-life-timeline__marker"

            const date = document.createElement("div")
            date.className = "person-life-timeline__date"
            date.textContent = item.date || "Non renseigné"

            const tooltip = document.createElement("div")
            tooltip.className = "person-life-timeline__tooltip"
            tooltip.textContent = item.tooltip || `${item.label} - ${item.date || "Non renseigné"}`

            node.appendChild(label)
            node.appendChild(marker)
            node.appendChild(date)
            node.appendChild(tooltip)
            axis.appendChild(node)
          })

          timelineEl.appendChild(axis)
        }

        function getCurrentPanelPerson() {
          const dataset = getCurrentDataset()
          const personId = currentPanelPersonId || f3Chart.getMainDatum()?.id
          return dataset.find(person => String(person.id) === String(personId)) || null
        }

        function buildLifeTimelineData(person, formHost) {
          const birthValue = getLifeDateValue(person, formHost, "birthday")
          const weddingValue = getLifeDateValue(person, formHost, "weddingday")
          const deathValue = getLifeDateValue(person, formHost, "lastday")
          const childEvents = getChildBirthEvents(person)
          const hasDeathDate = !!parseDateParts(deathValue)

          const datedParts = [
            parseDateParts(birthValue),
            parseDateParts(weddingValue),
            parseDateParts(deathValue),
            ...childEvents.map(child => child.parts)
          ].filter(Boolean)

          const yearRange = getTimelineYearRange(datedParts, {extendToFuture: !hasDeathDate})
          const childItems = buildChildrenTimelineItems(childEvents, yearRange)
          const items = spreadTimelineItems([
            buildTimelineItem("birth", "Naissance", birthValue, yearRange),
            buildTimelineItem("wedding", "Mariage", weddingValue, yearRange),
            ...childItems,
            buildTimelineItem("death", "Décès", deathValue, yearRange)
          ].filter(Boolean))

          return {
            hasKnownDate: items.some(item => !!item.date),
            items
          }
        }

        function getLifeDateValue(person, formHost, fieldName) {
          const input = formHost.querySelector(`input[name="${fieldName}"]`)
          if (input) return input.value
          return person?.data?.[fieldName] || ""
        }

        function getChildBirthEvents(person) {
          const childIds = person?.rels?.children || []
          if (!childIds.length) return []

          const dataset = getCurrentDataset()
          return childIds
            .map(childId => dataset.find(candidate => String(candidate.id) === String(childId)))
            .filter(Boolean)
            .map(child => {
              const parts = parseDateParts(child.data?.birthday)
              if (!parts) return null
              const firstName = child.data?.["first name"] || "Enfant"
              return {
                child,
                parts,
                firstName,
                year: Number(parts.year),
                date: formatDateForPanel(child.data?.birthday),
                tooltip: `${firstName} - ${formatDateForPanel(child.data?.birthday)}`
              }
            })
            .filter(Boolean)
            .sort((a, b) => getDateSortValue(a.parts) - getDateSortValue(b.parts))
        }

        function buildChildrenTimelineItems(childEvents, yearRange) {
          if (!childEvents.length) return []

          const positionedChildren = childEvents.map(child => ({
            ...child,
            position: getTimelinePosition(child.parts, yearRange)
          }))

          if (childEvents.length > 1) {
            return [buildChildrenClusterItem(positionedChildren)]
          }

          const onlyChild = positionedChildren[0]
          return [{
            type: "child",
            label: onlyChild.firstName,
            date: onlyChild.parts.year,
            position: onlyChild.position,
            tooltip: onlyChild.tooltip,
            lane: 0
          }]
        }

        function buildChildrenClusterItem(children) {
          const averagePosition = children.reduce((sum, child) => sum + child.position, 0) / children.length
          return {
            type: "children",
            label: "Enfants",
            date: `${children.length} naissance${children.length > 1 ? "s" : ""}`,
            position: Math.min(94, Math.max(6, averagePosition)),
            tooltip: children.map(child => child.tooltip).join("\n"),
            lane: 0
          }
        }

        function buildTimelineItem(type, label, value, yearRange) {
          const parts = parseDateParts(value)
          return {
            type,
            label,
            date: parts ? formatDateForPanel(value) : "",
            position: parts ? getTimelinePosition(parts, yearRange) : getFallbackTimelinePosition(type),
            tooltip: parts ? `${label} - ${formatDateForPanel(value)}` : ""
          }
        }

        function getTimelineYearRange(partsList, {extendToFuture = false} = {}) {
          const futureEndParts = {
            day: "31",
            month: "12",
            year: String(new Date().getFullYear() + 30)
          }
          const effectivePartsList = extendToFuture ? [...partsList, futureEndParts] : partsList
          if (!effectivePartsList.length) return {min: 0, max: 1}
          const values = effectivePartsList.map(getDateSortValue)
          const min = Math.min(...values)
          const max = Math.max(...values)
          return min === max ? {min: min - 1, max: max + 1} : {min, max}
        }

        function getTimelinePosition(parts, yearRange) {
          const value = getDateSortValue(parts)
          const percent = ((value - yearRange.min) / (yearRange.max - yearRange.min)) * 100
          return Math.min(94, Math.max(6, percent))
        }

        function getFallbackTimelinePosition(type) {
          return {
            birth: 6,
            wedding: 42,
            children: 60,
            death: 94
          }[type] || 50
        }

        function spreadTimelineItems(items) {
          const minimumGap = 18
          const sorted = [...items].sort((a, b) => a.position - b.position)

          sorted.forEach((item, index) => {
            if (index === 0) {
              item.position = Math.max(6, item.position)
              return
            }
            const previous = sorted[index - 1]
            item.position = Math.max(item.position, previous.position + minimumGap)
          })

          for (let index = sorted.length - 1; index >= 0; index -= 1) {
            const item = sorted[index]
            if (index === sorted.length - 1) {
              item.position = Math.min(94, item.position)
              continue
            }
            const next = sorted[index + 1]
            item.position = Math.min(item.position, next.position - minimumGap)
          }

          sorted.forEach(item => {
            item.position = Math.min(94, Math.max(6, item.position))
          })

          stackTimelineLabels(sorted)

          return items
        }

        function stackTimelineLabels(sortedItems) {
          const minimumLabelGap = 26
          const activeItems = sortedItems.filter(item => item.date)
          const occupiedLevels = []

          getTimelineStackPriority()
            .map(type => activeItems.find(item => item.type === type || (type === "children" && item.type === "child")))
            .filter(Boolean)
            .forEach(item => {
              const maxLevel = getTimelineMaxStackLevel(item.type)
              let level = 0
              while (level < maxLevel && occupiedLevels[level]?.some(position => Math.abs(position - item.position) < minimumLabelGap)) {
                level += 1
              }
              item.stackLevel = level
              occupiedLevels[level] ||= []
              occupiedLevels[level].push(item.position)
            })
        }

        function getTimelineStackPriority() {
          return ["birth", "death", "wedding", "children"]
        }

        function getTimelineMaxStackLevel(type) {
          return {
            birth: 0,
            death: 1,
            wedding: 2,
            child: 3,
            children: 3
          }[type] ?? 3
        }

        function setTextContentIfChanged(element, text) {
          if (element && element.textContent !== text) {
            element.textContent = text
          }
        }

        function resolveNumericValue(inputValue, infoField) {
          const candidate = parseFloat(inputValue)
          if (Number.isFinite(candidate)) return candidate
          if (infoField) {
            const text = infoField.querySelector(".f3-info-field-value")?.textContent?.trim()
            const parsed = parseFloat(text)
            if (Number.isFinite(parsed)) return parsed
          }
          return NaN
        }

        function resolveTextValue(inputValue, infoField) {
          const infoValue = infoField?.querySelector(".f3-info-field-value")
          const raw = inputValue ?? infoValue?.dataset.originalValue ?? infoValue?.textContent
          if (!raw) return ""
          return String(raw).trim()
        }

        function normalizeOptionalText(value = "") {
          const normalized = String(value).trim()
          if (/^(non renseigné|non renseigne|null|undefined|-|n\/a)$/i.test(normalized)) return ""
          return normalized
        }

        async function geocodeAddress(query) {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
          try {
            const res = await fetch(url, {headers: {"Accept": "application/json"}})
            if (!res.ok) return null
            const data = await res.json()
            const first = Array.isArray(data) ? data[0] : null
            if (!first) return null
            const lat = parseFloat(first.lat)
            const lng = parseFloat(first.lon)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
            return {lat, lng}
          } catch (err) {
            console.warn("Geocoding failed", err)
            return null
          }
        }

        function debounce(fn, wait = 300) {
          let timeoutId = null
          return (...args) => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => fn(...args), wait)
          }
        }

        function initLastNameAutocomplete(panel) {
          if (!panel || panel.dataset.lastnameAutocomplete === 'true') return
          panel.dataset.lastnameAutocomplete = 'true'
          panel.addEventListener('focusin', (event) => {
            const target = event.target
            if (target.matches('input[name="last name"]')) {
              attachAutocompleteToInput(target)
            }
          })
        }

        function attachAutocompleteToInput(input) {
          if (input.dataset.autocompleteAttached) return
          const fieldWrapper = input.closest('.f3-form-field') || input.parentElement
          const suggestionBox = document.createElement('div')
          suggestionBox.className = 'lastname-suggestions'
          fieldWrapper.appendChild(suggestionBox)

          input.setAttribute('autocomplete', 'off')
          input.dataset.autocompleteAttached = 'true'

          const render = () => renderSuggestions(input, suggestionBox)
          input.addEventListener('input', render)
          input.addEventListener('focus', render)
          input.addEventListener('blur', () => {
            setTimeout(() => hideSuggestions(suggestionBox), 150)
          })

          suggestionBox.addEventListener('mousedown', (event) => {
            const value = event.target.getAttribute('data-value')
            if (value) {
              input.value = value
              hideSuggestions(suggestionBox)
            }
          })
        }

        function renderSuggestions(input, suggestionBox) {
          if (!f3EditTree.isAddingRelative()) {
            hideSuggestions(suggestionBox)
            return
          }
          const suggestions = filterLastNames(input.value)
          if (!suggestions.length) {
            hideSuggestions(suggestionBox)
            return
          }
          suggestionBox.innerHTML = suggestions.map(name => `<div data-value="${name}">${name}</div>`).join('')
          suggestionBox.style.display = 'block'
        }

        function hideSuggestions(box) {
          box.innerHTML = ''
          box.style.display = 'none'
        }

        function filterLastNames(value = '') {
          const query = value.trim().toLowerCase()
          if (query.length < 3) return []
          return lastNameSuggestions
            .filter(name => name && name.toLowerCase().includes(query))
            .slice(0, 10)
        }

        function extractLastNames(dataset = []) {
          const names = new Set()
          dataset.forEach(person => {
            const name = person?.data?.["last name"]
            if (name) names.add(name)
          })
          return Array.from(names).sort((a, b) => a.localeCompare(b))
        }
        function getCurrentDataset() {
          if (typeof f3EditTree.getStoreData === 'function') {
            return applyAvatarFallback(f3EditTree.getStoreData())
          }
          const dataJson = typeof f3EditTree.getDataJson === 'function' ? f3EditTree.getDataJson() : '[]'
          const parsed = safeParseDataJson(dataJson)
          return Array.isArray(parsed) ? applyAvatarFallback(parsed) : []
        }

        function queueDataPersistence() {
          pendingSavePayload = safeParseDataJson(typeof f3EditTree.getDataJson === 'function' ? f3EditTree.getDataJson() : '[]')
          if (!pendingSavePayload) return
          if (saveTimeoutId) clearTimeout(saveTimeoutId)
          updateSaveStatus('saving')
          saveTimeoutId = window.setTimeout(() => {
            saveTimeoutId = null
            persistDataset(pendingSavePayload)
          }, 800)
        }

        function safeParseDataJson(dataJson) {
          try {
            return JSON.parse(dataJson)
          } catch (error) {
            console.error("Unable to parse chart data", error)
            return null
          }
        }

        function persistDataset(dataset) {
          const { endpoint, apiKey } = getPersistenceConfig()
          const headers = {"Content-Type": "application/json"}
          if (apiKey) {
            headers["x-api-key"] = apiKey
          }

          fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({data: dataset})
          })
            .then(res => {
              if (!res.ok) throw new Error("Server rejected save request")
              return res.json()
            })
            .then(() => {
              updateSaveStatus('success')
              window.setTimeout(() => updateSaveStatus('idle'), 2500)
            })
            .catch(error => {
              console.error("Failed to persist data_db.json", error)
              updateSaveStatus('error', error.message)
            })
        }

        function updateSaveStatus(state, message) {
          if (!saveStatusElement) return
          saveStatusElement.classList.remove("saving", "success", "error")
          if (state === 'saving') {
            saveStatusElement.textContent = "Saving changes…"
            saveStatusElement.classList.add("saving")
          } else if (state === 'success') {
            saveStatusElement.textContent = "All changes saved"
            saveStatusElement.classList.add("success")
          } else if (state === 'error') {
            const errorMsg = message ? `Save failed: ${message}` : "Save failed"
            saveStatusElement.textContent = errorMsg
            saveStatusElement.classList.add("error")
          } else {
            saveStatusElement.textContent = ""
          }
        }
    }

    function getPersistenceConfig() {
      if (typeof window === "undefined") {
        return { endpoint: "/api/family-data", apiKey: "" }
      }
      const rawConfig = window.GENEA_API_CONFIG || {}
      const baseUrl = typeof rawConfig.baseUrl === "string" ? rawConfig.baseUrl.trim().replace(/\/$/, "") : ""
      const apiKey = typeof rawConfig.apiKey === "string" ? rawConfig.apiKey : ""
      const endpoint = baseUrl ? `${baseUrl}/api/family-data` : "api/family-data"
      const healthEndpoint = baseUrl ? `${baseUrl}/health` : ""
      return { endpoint, healthEndpoint, apiKey }
    }

    function formatBirthDate(value) {
      return formatDateValue(value)
    }

    function formatDateLine(label, value) {
      const formatted = formatDateValue(value)
      return formatted ? `${label} : ${formatted}` : ""
    }

    function formatDateValue(value) {
      const normalized = normalizeDateInput(value)
      if (!normalized) return ""
      if (isPlaceholderDate(normalized)) return ""

      const externalFormatter = getExternalFormatter()
      if (externalFormatter) {
        try {
          return externalFormatter(normalized)
        } catch (err) {
          console.warn("External formatter failed, falling back to default", err)
        }
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
        const year = normalized.substring(0, 4)
        const month = normalized.substring(5, 7)
        const day = normalized.substring(8, 10)
        return `${day}/${month}/${year}`
      }
      return normalized
    }

    function formatDateForPanel(value) {
      const parts = parseDateParts(value)
      if (!parts) return normalizeDateInput(value)
      return `${parts.day}-${parts.month}-${parts.year}`
    }

    function formatDateForEditInput(value) {
      const parts = parseDateParts(value)
      if (!parts) return normalizeDateInput(value)
      return `${parts.day}/${parts.month}/${parts.year}`
    }

    function formatCalendarDateForEditInput(value) {
      const parts = parseDateParts(value)
      if (!parts) return ""
      return `${parts.day}/${parts.month}/${parts.year}`
    }

    function toCalendarDateValue(value) {
      const parts = parseDateParts(value)
      if (!parts) return ""
      return `${parts.year}-${parts.month}-${parts.day}`
    }

    function parseDateParts(value) {
      const normalized = normalizeDateInput(value)
      if (!normalized || isPlaceholderDate(normalized)) return null

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

    function getDateSortValue(parts) {
      return Number(parts.year) * 10000 + Number(parts.month) * 100 + Number(parts.day)
    }

    function formatAgeForPanel(birthValue, deathValue) {
      const birthParts = parseDateParts(birthValue)
      if (!birthParts) return ""
      const deathParts = parseDateParts(deathValue)
      const endDate = deathParts
        ? dateFromParts(deathParts)
        : new Date()
      const birthDate = dateFromParts(birthParts)
      let age = endDate.getFullYear() - birthDate.getFullYear()
      const hasHadBirthday = endDate.getMonth() > birthDate.getMonth()
        || (endDate.getMonth() === birthDate.getMonth() && endDate.getDate() >= birthDate.getDate())
      if (!hasHadBirthday) age -= 1
      if (age < 0) return ""
      return `${age} ans`
    }

    function dateFromParts(parts) {
      return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
    }

    function isBirthDateLabel(label = "") {
      return /^(birthday|date de naissance)$/i.test(label.trim())
    }

    function isTimelineOnlyDateLabel(label = "") {
      return /^(mariage|date de mariage|décès|deces|date de décès|date de deces)$/i.test(label.trim())
    }

    function isDateFieldLabel(label = "") {
      return /^(birthday|date de naissance|mariage|date de mariage|décès|deces|date de décès|date de deces)$/i.test(label.trim())
    }

    function getExternalFormatter() {
      if (typeof window === "undefined") return null
      const maybeUtils = window.utils || window.utils_dates
      const candidate = maybeUtils && (maybeUtils.default?.formatDate || maybeUtils.formatDate)
      return typeof candidate === "function" ? candidate.bind(maybeUtils.default || maybeUtils) : null
    }

    function normalizeDateInput(value) {
      if (!value || typeof value !== "string") return ""
      const trimmed = value.trim()
      if (!trimmed || trimmed === "null") return ""
      return trimmed
    }

    function normalizeBirthDateInput(value) {
      return normalizeDateInput(value)
    }

    function isPlaceholderDate(value) {
      const canonical = value
        .replace(/T.+$/, '')
        .replace(/\s.+$/, '')
        .replace(/\//g, '-')
      return canonical === '1970-01-01'
    }

    function isPlaceholderBirthDate(value) {
      return isPlaceholderDate(value)
    }

    function truncateFirstWords(value = "") {
      if (typeof value !== "string") return ""
      return value.trim().split(/\s+/).slice(0, 2).join(" ")
    }

    function getPersonDisplayName(person) {
      return [person?.data?.["first name"], person?.data?.["last name"]]
        .filter(Boolean)
        .join(" ")
        .trim() || "Profil sans nom"
    }

    // function resolveAvatar(datum) {
    //   const img = datum?.data?.avatar
    //   if (img && img !== "null" && img !== "") return img
    //   return "deschampsberger/images/profil_base.svg"
    // }

    function resolveAvatar(datum) {
      const img = datum?.data?.avatar
      if (img && img !== "null" && img !== "") return img
      return "deschampsberger/images/profil_base.svg"
    }

    function applyAvatarFallback(dataset = []) {
      const fallback = "deschampsberger/images/profil_base.svg"
      dataset.forEach(person => {
        if (!person || !person.data) return
        const avatar = person.data.avatar
        if (!avatar || avatar === "null" || avatar === "") {
          person.data.avatar = fallback
        }
      })
      return dataset
    }
