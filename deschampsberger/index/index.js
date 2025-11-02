fetch("./data_db.json")
  .then(res => res.json())
  .then(data => create(data))
  .catch(err => console.error(err))

    function create(data){

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
               const updated_data = f3EditTree.exportData()
               console.log(updated_data)
             })
        // .setNoEdit()  // if you want to just see info form

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
    }