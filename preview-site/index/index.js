fetch("./data_db.json")
  .then(res => res.json())
  .then(data => create(data))
  .catch(err => console.error(err))

    function create(data){

      let lastNameSuggestions = extractLastNames(data)
      let saveTimeoutId = null
      let pendingSavePayload = null
      const saveStatusElement = document.getElementById("SaveDataStatus")

      const f3Chart = f3.createChart('#FamilyChart', data)
              .setTransitionTime(100)
              .setCardXSpacing(250)
              .setCardYSpacing(150)

      const initialMainId = 3
      const initialMainDatum = data.find(person => person.id === initialMainId)
      if (initialMainDatum) {
        f3Chart.updateMainId(initialMainDatum.id)
      }

      const f3Card = f3Chart.setCardHtml()
        .setCardDisplay([
          ["first name","last name"],
          d => formatBirthDate(d.data["birthday"])
        ])

      const f3EditTree = f3Chart.editTree()
        .setFields([
          "first name",
          "last name",
          "birthday",
          { id: "avatar", label: "Photo URL", type: "text" },
          { id: "address", label: "Adresse", type: "text" },
          // { id: "geometry_lat", label: "Latitude", type: "text" },
          // { id: "geometry_lng", label: "Longitude", type: "text" },
          // { id: "geom", label: "Geom", type: "text" },
          { id: "commentaire", label: "Commentaire", type: "textarea" }
        ])
        .setEditFirst(false)  // true = open form on click, false = open info in click
        .setCardClickOpen(f3Card)
        .setOnChange(() => {
               const updated_data = getCurrentDataset()
               lastNameSuggestions = extractLastNames(updated_data)
               queueDataPersistence()
             })
        // .setNoEdit()  // if you want to just see info form
      setupEditPanel()

      f3Chart.updateTree({initial: true})
      f3EditTree.open(f3Chart.getMainDatum())
      f3Chart.updateTree(initialMainDatum ? {tree_position: 'main_to_middle'} : {initial: true})

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
          const target = data.find(d => d.id === personId)
          if (!target) {
            console.warn(`Impossible de trouver la personne ${personId}`)
            return
          }
          f3Chart.updateMainId(target.id)
          const tree_position = shouldCenter ? 'main_to_middle' : 'inherit'
          f3Chart.updateTree({tree_position})
          const currentMain = f3Chart.getMainDatum()
          if (currentMain) f3EditTree.open(currentMain)
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
          }
        }

        function hookPersonFormEnhancer(formCont) {
          if (!formCont || formCont.dataset.formEnhancerAttached === "true") return
          formCont.dataset.formEnhancerAttached = "true"
          const observer = new MutationObserver(() => {
            window.requestAnimationFrame(() => enhancePersonForm(formCont))
          })
          observer.observe(formCont, {childList: true, subtree: true})
          enhancePersonForm(formCont)
        }

        function enhancePersonForm(formHost) {
          const form = (formHost || document).querySelector("form")
          if (!form) return
          enhanceAvatarField(formHost)
          enhanceMapField(formHost)
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
              <img src="${getAvatarValue() || 'https://via.placeholder.com/260x180?text=Portrait'}" alt="Portrait" />
            </div>
            <div class="person-media__actions">
              ${avatarInput ? `
                <label class="person-media__upload">
                  <input type="file" accept="image/*" class="person-media__file" />
                  <span>Importer une photo</span>
                </label>
                <span class="person-media__hint">ou coller une URL</span>
              ` : `<span class="person-media__hint">Photo non modifiable</span>`}
            </div>
          `

          if (avatarInput) {
            avatarInput.classList.add("visually-hidden")
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
            img.src = url || "https://via.placeholder.com/260x180?text=Portrait"
          }
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
          const birthdayWrapper = findFieldWrapper(formHost, 'birthday', 'Birthday')
          ;[lastNameWrapper, firstNameWrapper, birthdayWrapper].forEach(wrapper => {
            if (wrapper && wrapper.parentElement !== detailsSlot) detailsSlot.appendChild(wrapper)
          })

          function findFieldWrapper(scope, name, labelText) {
            const input = scope.querySelector(`input[name="${name}"]`)
            if (input) return input.closest('.f3-form-field')
            return getInfoFieldByLabel(scope, labelText, name) || null
          }
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
          const addressValue = resolveTextValue(addressInput?.value, addressInfo)

          const editable = !!latInput && !!lngInput && !formHost.querySelector("form")?.classList.contains("non-editable")
          const existingWrapper = formHost.querySelector(".person-map")
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

          if (!hasRenderedSomething) {
            setStatus("Ajoutez une adresse ou des coordonnées pour afficher la carte.")
            return
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
          const raw = inputValue ?? infoField?.querySelector(".f3-info-field-value")?.textContent
          if (!raw) return ""
          return String(raw).trim()
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
            return f3EditTree.getStoreData()
          }
          const dataJson = typeof f3EditTree.getDataJson === 'function' ? f3EditTree.getDataJson() : '[]'
          const parsed = safeParseDataJson(dataJson)
          return Array.isArray(parsed) ? parsed : []
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
      return { endpoint, apiKey }
    }

    function formatBirthDate(value) {
      const normalized = normalizeBirthDateInput(value)
      if (!normalized) return ""
      if (isPlaceholderBirthDate(normalized)) return ""

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

    function getExternalFormatter() {
      if (typeof window === "undefined") return null
      const maybeUtils = window.utils || window.utils_dates
      const candidate = maybeUtils && (maybeUtils.default?.formatDate || maybeUtils.formatDate)
      return typeof candidate === "function" ? candidate.bind(maybeUtils.default || maybeUtils) : null
    }

    function normalizeBirthDateInput(value) {
      if (!value || typeof value !== "string") return ""
      const trimmed = value.trim()
      if (!trimmed || trimmed === "null") return ""
      return trimmed
    }

    function isPlaceholderBirthDate(value) {
      const canonical = value
        .replace(/T.+$/, '')
        .replace(/\s.+$/, '')
        .replace(/\//g, '-')
      return canonical === '1970-01-01'
    }
