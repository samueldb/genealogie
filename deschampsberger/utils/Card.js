import f3 from '../../src/index.js'
import utils_dates from "./utils_dates.js";
import editTree from "../../src/CreateTree/editTree.js";
import createRelative from "./createRelative.js"
import createNewRelative from "./createRelative.js";
//import d3 from "../../src/d3.js";
//import {pathToMain} from "../../src/CalculateTree/createLinks.js";

function CustomCard(tree, svg, onCardClick, data) {
    const card_dim = {w:220,h:70,text_x:75,text_y:15,img_w:60,img_h:60,img_x:5,img_y:5}
    return function (d) {
        return f3.elements.Card({
            svg,
            card_dim,
            card_display: [d => `${d.data["first name"]} ${d.data["last name"]}`, d=> `né(e) le ${utils_dates.formatDate(d.data["birthday"])}`],
            onCardClick,
            img: true,
            mini_tree: true,
            onMiniTreeClick: onCardClick,
            transition_time: 500,
            // link_break: false,
            //onHover: setOnHoverPathToMain,
            onCardUpdate,
            createNewRelative
        }).call(this, d)
    }

    function onCardUpdate(d) {
        const g = d3.select(this).select('.card-inner').append('g')
        g.on('click', (event) => {
            console.log('custom element clicked', d)
        })
        //g.html(customAddBtn(card_dim))
        // g.html(customAddRelativesBtn(card_dim, d))
        const g2 = d3.select(this).select('.card-inner').append('g').html(`
        <g class="customAddBtn" style="cursor: pointer">
          <g class="add-spouse" transform="translate(${card_dim.w - 150}, ${card_dim.h - 20}) scale(0.8)">
            <rect x="0" y="0" width="60" height="20" rx="5" ry="5" fill="grey" stroke="#000" />
            <text id="editBtn_add" x="30" y="10" text-anchor="middle" alignment-baseline="middle" font-size="12" fill="#000">
              + conjoint
            </text>
          </g>
          <g class="add-child" transform="translate(${card_dim.w - 100}, ${card_dim.h - 20}) scale(0.8)">
            <rect x="0" y="0" width="60" height="20" rx="5" ry="5" fill="grey" stroke="#000" />
            <text id="editBtn_add" x="30" y="10" text-anchor="middle" alignment-baseline="middle" font-size="12" fill="#000">
              + enfant
            </text>
          </g>
          <g class="add-parent" transform="translate(${card_dim.w - 50}, ${card_dim.h - 20}) scale(0.8)">
            <rect x="0" y="0" width="60" height="20" rx="5" ry="5" fill="grey" stroke="#000" />
            <text id="editBtn_add" x="30" y="10" text-anchor="middle" alignment-baseline="middle" font-size="12" fill="#aaOOOO">
              + parent
            </text>
          </g>
        </g>
        `);

            g2.select(".add-spouse").on("click", () => {
                console.log('add spouse was clicked for d ',d);
                createNewRelative("spouse", d)
            });
            g2.select(".add-child").on("click", () => {
                console.log('add child was clicked for d ',d);
                createNewRelative("child", d)
            });
            g2.select(".add-parent").on("click", () => {
                console.log('add parent was clicked for d ',d);
                createNewRelative("parent", d)
            });
            return g.node();
    }
}


function setOnHoverPathToMain() {
    this.onCardMouseenter = this.onEnterPathToMain.bind(this)
    this.onCardMouseleave = this.onLeavePathToMain.bind(this)
    return this
}


CustomCard.prototype.unsetOnHoverPathToMain = function() {
    this.onCardMouseenter = null
    this.onCardMouseleave = null
    return this
}

CustomCard.prototype.onEnterPathToMain = function(e, datum) {
    this.to_transition = datum.data.id
    const main_datum = this.store.getTreeMainDatum()
    const cards = d3.select(this.cont).select('div.cards_view').selectAll('.card_cont')
    const links = d3.select(this.cont).select('svg.main_svg .links_view').selectAll('.link')
    const [cards_node_to_main, links_node_to_main] = pathToMain(cards, links, datum, main_datum)
    cards_node_to_main.forEach(d => {
        const delay = Math.abs(datum.depth - d.card.depth) * 200
        d3.select(d.node.querySelector('div.card-inner'))
            .transition().duration(0).delay(delay)
            .on('end', () => this.to_transition === datum.data.id && d3.select(d.node.querySelector('div.card-inner')).classed('f3-path-to-main', true))
    })
    links_node_to_main.forEach(d => {
        const delay = Math.abs(datum.depth - d.link.depth) * 200
        d3.select(d.node)
            .transition().duration(0).delay(delay)
            .on('end', () => this.to_transition === datum.data.id && d3.select(d.node).classed('f3-path-to-main', true))
    })

    return this
}

CustomCard.prototype.onLeavePathToMain = function(e, d) {
    this.to_transition = false
    d3.select(this.cont).select('div.cards_view').selectAll('div.card-inner').classed('f3-path-to-main', false)
    d3.select(this.cont).select('svg.main_svg .links_view').selectAll('.link').classed('f3-path-to-main', false)

    return this
}

CustomCard.prototype.createNewRelative = function(e, d) {
    console.log('createNewRelative function called : '+d);
    alert('createNewRelative function called : '+d);
    return this
}

function showToolbox(targetGroup, event) {
    // Remove existing toolbox if any
    const svg = d3.select('svg');
    d3.select('.toolbox').remove();

    const [x, y] = d3.pointer(event);

    const toolbox = targetGroup.append('g')
        .attr('class', 'toolbox')
//        .attr('transform', `translate(${x}, ${y})`);
        .attr('transform', `translate(0, 0)`);

    const actions = ['Add Son', 'Add Daughter', 'Add Father', 'Add Mother', 'Add Spouse'];

    toolbox.selectAll('g.button')
        .data(actions)
        .enter()
        .append('g')
        .attr('class', 'button')
        .attr('transform', (d, i) => `translate(0, ${i * 30})`)
        .on('click', (event, action) => {
            console.log(`${action} clicked`);
            d3.select('.toolbox').remove(); // optional: hide toolbox after action
            event.stopPropagation(); // prevent triggering background click
        })
        .each(function (d) {
            d3.select(this)
                .append('rect')
                .attr('width', 120)
                .attr('height', 25)
                .attr('fill', '#eee')
                .attr('stroke', '#aaa')
                .attr('rx', 5);

            d3.select(this)
                .append('text')
                .attr('x', 10)
                .attr('y', 17)
                .text(d)
                .attr('font-size', '12px')
                .attr('fill', '#333');
        });

    // Optional: remove toolbox when clicking outside
    //svg.on('click', () => d3.select('.toolbox').remove());
}



export {
    CustomCard
}