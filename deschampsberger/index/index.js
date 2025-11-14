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

      const f3Card = f3Chart.setCardHtml()
        .setCardDisplay([["first name","last name"],["birthday"]])

      const f3EditTree = f3Chart.editTree()
        .setFields(["first name","last name","birthday"])
        .setEditFirst(true)  // true = open form on click, false = open info in click
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
      f3Chart.updateTree({initial: true})

        // zoom to my card
        const datum = data.find(d=>d.data['first name']=='Samuel')
        f3Chart.updateMainId(datum.id)

      /*
      DROPDOWN SEARCH
       */
        // setup search dropdown
        // this is basic showcase, please use some autocomplete component and style it as you want

        const all_select_options = []
        data.forEach(d => {
            if (all_select_options.find(d0 => d0.value === d["id"])) return
            all_select_options.push({label: `${d.data["first name"]+' '+d.data["last name"]+' né(e) le '+utils.default.formatDate(d.data["birthday"])}`, value: d["id"]})
        })
        const search_cont = d3.select(document.querySelector("#RecherchePersonne")).append("div")
            // .attr("style", "position: absolute; top: 10px; left: 10px; width: 150px; z-index: 1000;")
            .on("focusout", () => {
                setTimeout(() => {
                    if (!search_cont.node().contains(document.activeElement)) {
                        updateDropdown([]);
                    }
                }, 200);
            })
        const search_input = search_cont.append("input")
            .attr("style", "width: 100%;")
            .attr("type", "text")
            .attr("placeholder", "Search")
            .on("focus", activateDropdown)
            .on("input", activateDropdown)

        const dropdown = search_cont.append("div").attr("style", "overflow-y: auto; max-height: 300px; background-color: #FFF;")
            .attr("tabindex", "0")
            .on("wheel", (e) => {
                e.stopPropagation()
            })

        function activateDropdown() {
            const search_input_value = search_input.property("value")
            const filtered_options = all_select_options.filter(d => d.label.toLowerCase().includes(search_input_value.toLowerCase()))
            updateDropdown(filtered_options)
        }

        function updateDropdown(filtered_options) {
            dropdown.selectAll("div").data(filtered_options).join("div")
                .attr("style", "padding: 5px;cursor: pointer;border-bottom: .5px solid currentColor;")
                .on("click", (e, d) => {
                    updateTreeWithNewMainPerson(d.value, true)
                })
                .text(d => d.label)
        }

        function setupEditPanel() {
          const editPanelWrapper = document.getElementById("EditPanelFormHost") || document.getElementById("EditPanel") || document.getElementById("sidebar")
          const currentFormCont = document.querySelector("#FamilyChart .f3-form-cont")
          if (editPanelWrapper && currentFormCont) {
            editPanelWrapper.prepend(currentFormCont)
            f3EditTree.form_cont = currentFormCont
            f3EditTree.fixed()
            initLastNameAutocomplete(editPanelWrapper)
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
          fetch("/api/family-data", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
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
