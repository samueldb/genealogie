/**
 * Diagram related
 */
import * as d3 from "d3";
import $ from "jquery";

import {event} from "d3-selection";

Array.prototype.max = function () {
    var max = 0;
    for (var el of this) {
        if (el == 'undefined' || el == NaN) {
        }
        else {
            if (el > max) {
                max = el;
            }
        }
    }
    return max;
};

export function ascendingXPosition(a, b) {
    return a.x - b.x;
}

export function ascendingYPosition(a, b) {
    return a.y - b.y;
}

export function formatNumber(d) {
    var numberFormat = d3.format(",.0f"); // zero decimal places
    return " - " + numberFormat(d);
}

export function formatFlow(d) {
    var flowFormat = d3.format(",.0f"); // zero decimal places with sign
    return flowFormat(Math.abs(d));
}

export function expand(node) {
    node.state = "expanded";
    node.children.forEach(function (child) {
        child.state = "collapsed";
        child._parent = this;
        child.parent = null;
        containChildren(child);
    }, node);
}

export function collapse(node) {
    node.state = "collapsed";
    containChildren(node);
}

export function showHideChildren(node) {
    disableUserInterractions(2 * TRANSITION_DURATION);
    hideTooltip();
    if (node.state === "collapsed") { expand(node); }
    else { collapse(node); }

    biHiSankey.relayout();
    update();
    link.attr("d", path);
    restoreLinksAndNodes();
}

export function hide(node) {
    disableUserInterractions(2 * TRANSITION_DURATION);
    hideTooltip();
    if (typeof (node.state) != 'undefined') {
        if (node.state === "collapsed") { expand(node); }
        else if (node.state === "contained") {
            expand(node);
            var him = noeudsExistants.find(function (a) { a.id == node.id });
            var her = noeudsExistants.find(function (a) { a.c_id == node.id });
            //collapse(him);
            //expand(her);
        }
        else { /*collapse(node);*/ }
    }
    biHiSankey.relayout();
    update();
    var path = biHiSankey.link().curvature(0.5);
    link.attr("d", path);
    restoreLinksAndNodes();
}

export function isParentCelib(nodes, link) {
    var isInCouple = 0;
    var isParent = 0;
    if (link.source != null) {
        nodes.forEach(function (n) {
            if (n.c_id == link.source.id) {
                isInCouple += 1; // Si la personne est en couple avec le noeud, c'est mort
            }
        });
        nodes.forEach(function (n) {
            if (n.f_id == link.source.id || n.m_id == link.source.id) {
                isParent += 1;
            }
        });
    }
    if (isInCouple == 0 && isParent > 0) { return true; }
    else { return false; }
}

/**
 *  User related
 */
export function dragmove(node) {
    // node.x = Math.max(0, Math.min(WIDTH - node.width, event.x));           // On supprime cette ligne pour ne garder que le déplacement vertical.
    //node.y = Math.max(0, Math.min(HEIGHT - node.height, event.y));
    //d3.select(this).attr("transform", "translate(" + node.x + "," + node.y + ")");
    //biHiSankey.relayout();
    var path = biHiSankey.link().curvature(0.5);
    svg.selectAll(".node").selectAll("circle").attr("height", function (d) { return d.height; });
    link.attr("d", path);
}

// Used when temporarily disabling user interractions to allow animations to complete
export function disableUserInterractions(time) {
    isTransitioning = true;
    setTimeout(function () {
        isTransitioning = false;
    }, time);
};

export function hideObject(obj) {
    $(obj).css('visibility', 'hidden');
    $(obj).css('display', 'none');
}

export function showObject(obj) {
    $(obj).css('visibility', 'visible');
    $(obj).css('display', 'initial');
}


/**
 * Tooltip related
 */
export function hideTooltip() {
    var tooltip = d3.select("#tooltip");
    tooltip.transition().style("opacity", 0).select(".cimg").attr("src", "");
    return tooltip.transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", 0);
};

export function showTooltip() {
    var tooltip = d3.select("#tooltip")
    return tooltip
        // .style("left", event.layerX + "px")
        // .style("left", "0 px")
        // .style("top", event.layerY + 15 + "px")
        // .style("float", "15 px")
        .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", 1);
};

/**
 * Arrow related
 */
export function def_arrow(svg, biHiSankey, LINK_COLOR, OUTFLOW_COLOR, INFLOW_COLOR) {
    var path = biHiSankey.link().curvature(0.5);

    var defs = svg.append("defs");

    defs.append("marker")
        .style("fill", LINK_COLOR)
        .attr("id", "arrowHead")
        .attr("viewBox", "0 0 6 10")
        .attr("refX", "1")
        .attr("refY", "5")
        .attr("markerUnits", "strokeWidth")
        .attr("strokeWidth", "20px")
        .attr("markerWidth", "1")
        .attr("markerHeight", "5")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

    defs.append("marker")
        .style("fill", OUTFLOW_COLOR)
        .attr("id", "arrowHeadInflow")
        .attr("viewBox", "0 0 6 10")
        .attr("refX", "1")
        .attr("refY", "5")
        .attr("markerUnits", "strokeWidth")
        .attr("strokeWidth", "20px")
        .attr("markerWidth", "1")
        .attr("markerHeight", "1")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

    defs.append("marker")
        .style("fill", INFLOW_COLOR)
        .attr("id", "arrowHeadOutlow")
        .attr("viewBox", "0 0 6 10")
        .attr("refX", "1")
        .attr("refY", "5")
        .attr("markerUnits", "strokeWidth")
        .attr("strokeWidth", "20px")
        .attr("markerWidth", "1")
        .attr("markerHeight", "1")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");
}

/**
 Gestion des images affichées sur les noeuds
 */
export function addImage(noeud){
    if (noeud.length > 1){
        noeud = noeud.find(function(g){return g.id == noeud.id});
    }

    var pat = noeud
        .append("defs")
        .append("pattern")
        .attr("id",function(d){return "mImg_"+d.id})
        .attr("x","0")
        .attr("y","0")
        .attr("width", "48px")
        .attr("height", "48px")
        .style("fill","transparent")
        .style("stroke","back")
        .style("stroke-width","0.25");

    pat.append("image")
        .attr("xlink:href", function(d) {
            var image = 'https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/portraits/'+d.id+'.jpg';
            if (d.type == 'couple'){
                image = 'https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/image_couple.png';
            }
            else if (d.adr_photo != null){
                image = d.adr_photo;
            }
            else if (d.adr_photo == null){
                image = 'https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/no_photo.png';
            }
            return image;
        })
        .attr("x", "-0")
        .attr("y", "-0")
        .attr("width", "48px")
        .attr("height", "48px");

}