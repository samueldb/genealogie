import * as d3 from "d3";
import {biHiSankey} from "./bihisankey";
import {hide, hideTooltip, isParentCelib, showTooltip} from "./utils_tree";


export function dealWithLinks() {
    var link = d3.svg.select("#links").selectAll("path.link")
        .data(biHiSankey.visibleLinks(), function (d) { return d.id; });
    var path = biHiSankey.link().curvature(0.5);


    link.transition()
        .duration(TRANSITION_DURATION)
        .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
        .attr("d", path)
        .style("opacity", function (d) { return d.id.includes("c_") || isParentCelib(d) ? 1 : 0 });
    link.exit().remove();
    var linkEnter = link.enter().append("path")
        .attr("class", "link")
        .style("fill", "none");

    linkEnter.on('mouseenter', function (d) {
        if (!isTransitioning) {
            showTooltip().select(".value").text(function () {
                if (d.direction > 0) {
                    // return d.source.id + "--" + d.source.prenom + " -> " + d.target.prenom + " " + d.target.name + "\n";
                    return "direction " + d.direction + "-" + d.source.id + "--> " + d.target.id + "\n";
                }
                // return d.target.id + "--" + d.target.name + " <- " + d.source.name + d.source.prenom + "\n";
                return "direction " + d.direction + "-" + d.source.id + "--> " + d.target.id + "\n";
            });

            d3.select(this)
                .style("stroke", LINK_COLOR)
                .transition()
                .duration(TRANSITION_DURATION / 2)
                .style("opacity", function (d) { return d.id.includes("c_") || isParentCelib(biHiSankey.nodes(), d) ? 1 : 0 });
        }
    });

    linkEnter.on('mouseleave', function () {
        if (!isTransitioning) {
            hideTooltip();

            d3.select(this)
                .style("stroke", LINK_COLOR)
                .transition()
                .duration(TRANSITION_DURATION / 2)
                .style("opacity", function (d) { return d.id.includes("c_") || isParentCelib(biHiSankey.nodes(), d) ? 1 : 0 });
        }
    });

    linkEnter.sort(function (a, b) { return b.thickness - a.thickness; })
        .classed("leftToRight", function (d) {
            return d.direction > 0;
        })
        .classed("rightToLeft", function (d) {
            return d.direction < 0;
        })
        .style("marker-end", function () {
            return 'url(#arrowHead)';
        })
        .style("stroke", LINK_COLOR)
        .style("opacity", 0)
        .transition()
        .delay(TRANSITION_DURATION)
        .duration(TRANSITION_DURATION)
        .attr("d", path)
        .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
        .style("opacity", function (d) { return d.id.includes("c_") || isParentCelib(biHiSankey.nodes(), d) ? 1 : 0 });

    link.on("click", function (g) {
        if (!isTransitioning) {
            //alert('on vient de cliquer !');
            var gSource = g.source;
            // On récupère tous les enfants : 
            var Noeuds = biHiSankey.nodes();
            var nodeD = Noeuds.find(function (a) { return a.id == gSource.id || 'c_' + a.id == gSource.id });
            var e1 = getEnfants(nodeD, Noeuds);
            for (var e of e1) {
                if (e.c_id != "null" && e.c_id != "" && e.c_id != null) {
                    // Si l'enfant a un conjoint, on cache le couple
                    var noeudCouple = Noeuds.find(function (a) { return a.id == 'c_' + e.id || a.id == 'c_' + e.c_id; });
                    hide(noeudCouple);
                    var conj = Noeuds.find(function (a) { return a.c_id == e.id; });
                    // Si le conjoint n'a pas d'ancetre, on le cache aussi :
                    if (conj.nbAncetre == 0) {
                        hide(conj);
                        // On cherche les enfants de l'enfant :
                        var e2 = getEnfants(e, Noeuds);
                        for (var e2e of e2) {
                            e1.push(e2e);
                        }
                    }
                    else {

                    }
                }
                else {
                    // On cherche les enfants de l'enfant sans conjoint :
                    var e2 = getEnfants(e, Noeuds);
                    for (var e2e of e2) {
                        e1.push(e2e);
                    }
                }
                hide(e);

            }
        }
    });
}

export function getEnfants(val,Noeuds){
    try{
        var idParent = val.id;
        // On doit traiter également les couples : donc
        if (val.id.includes('c_')){
            idParent = val.id.substring(2);
        }
        var enfants = Noeuds.filter(function(a){
            return a.f_id == idParent || a.m_id == idParent;
        });
        return enfants;
    }
    catch(Err){
        console.log('erreur lors de la récupération des enfants (normale)');
    }
}