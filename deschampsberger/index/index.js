import f3 from '../../src/index.js'
import * as utils from '../utils/utils_dates.js'
import * as custom_Card from '../utils/Card.js'

fetch("./data_db.json")
    .then(r => r.json())
    .then(data => {
      let tree, main_id;

      const svg = f3.createSvg(document.querySelector("#FamilyChart"))
      const store = f3.createStore({
        data,
        node_separation: 250,
        level_separation: 150,
        single_parent_empty_card: false
      })

        const Card = custom_Card.CustomCard(store, svg, onCardClick, data);

        store.setOnUpdate(props => f3.view(store.getTree(), svg, Card, props || {}))


        store.updateTree({initial: true})

        // with person_id this function will update the tree
        function updateTreeWithNewMainPerson(person_id, animation_initial = true) {
            store.updateMainId(person_id)
            store.updateTree({initial: animation_initial})
        }

        // zoom to my card
        const datum = data.find(d=>d.data['first name']=='Samuel')
        updateTreeWithNewMainPerson(datum.id, false)

      // function updateTree(props) {
      //   tree = f3.CalculateTree({ data, main_id })
      //   f3.view(tree, svg, Card(tree, svg, onCardClick), props || {})
      //   const datum = tree.data.find(d=>d.data.data['first name']=='Samuel')  // zoom to my card
      //
      //   f3.handlers.cardToMiddle({datum, svg, svg_dim: svg.getBoundingClientRect(),  transition_time: 2000})
      // }
      // need to update main_id to follow click, if not, the svg always zoom on me ^^"
      // Follow this to search and zoom : https://donatso.github.io/family-chart-doc/examples/9-big-tree
      function updateMainId(_main_id) {
        main_id = _main_id
      }

      function onCardClick(e, d) {
            updateMainId(d.data.id)
          updateTreeWithNewMainPerson(d.data.id, false)
      }


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
                    updateTreeWithNewMainPerson(d.value, false)
                })
                .text(d => d.label)
        }
    })