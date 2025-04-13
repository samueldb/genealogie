import f3 from '../../src/index.js'
import utils_dates from "./utils_dates.js";

function CustomCard(tree, svg, onCardClick) {
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
            onCardUpdate
        }).call(this, d)
    }

    function onCardUpdate(d) {
        const g = d3.select(this).select('.card-inner').append('g')
        g.on('click', () => {
            console.log('custom element clicked', d)
            alert('custom element clicked: ' + d)
            // add some action here
        })
        g.html(customAddBtn(card_dim))
    }
}

function customAddBtn(card_dim) {
    return (`
    <g class="customAddBtn" style="cursor: pointer">
      <g transform="translate(${card_dim.w-12},${card_dim.h-12})scale(.08)">
        <circle r="100" fill="#fff" />
        <g transform="translate(-50,-45)">
          <line
            x1="10" x2="90" y1="50" y2="50"
            stroke="currentColor" stroke-width="20" stroke-linecap="round"
          />
          <line
            x1="50" x2="50" y1="10" y2="90"
            stroke="currentColor" stroke-width="20" stroke-linecap="round"
          />
        </g>
      </g>
    </g>
  `)
}


export {
    CustomCard
}