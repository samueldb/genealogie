import $ from "jquery";
import {behavior} from "d3-collection";
import * as d3 from "d3";
import {biHiSankey} from "./bihisankey";
import {isParentCelib} from "./utils_tree";

export function highlightConnected(nodes, g) {
    var link = d3.svg.select("#links").selectAll("path.link")
        .data(biHiSankey.visibleLinks(), function (d) { return d.id; });
    link.filter(function (d) {
        if (d.source === g) {
            console.log("source : " + d.source.id);
            return true;
        }
        if ((d.source != null || d.target != null)) {           // On récupère les enfants et le conjoint
            if (!isParentCelib(nodes, d) && g.parent != null) {
                if (d.target.id == g.parent.id || d.source.id == g.parent.id) {
                    console.log("source : " + d.source.id + " - " + d.target.id);
                    return true;
                }
                else if (g.parent == null) {
                    return (d.target === g || d.target.id == g.id)
                }
            }
            else {
                return false;
            }
        }
        return false;
    })
        .style("marker-end", function () { return 'url(#arrowHeadInflow)'; })
        .style("stroke", OUTFLOW_COLOR) // rouge
        .style("opacity", 1);

    link.filter(function (d) {
        if (d.target != null) {
            if (!isParentCelib(nodes, d) && g.parent != null) {
                if (d.target === g || d.target.id == g.parent.id) { console.log("target : " + d.target === g + " - " + d.target.id + " - " + d.target.id); }
                return (d.target === g || d.target.id == "c_" + g.f_id || d.target.id == "c_" + g.m_id || d.target.id == g.parent.id);
            }
            else if (g.parent == null) {
                return (d.target === g || d.target.id == g.id || d.target.id == "c_" + g.f_id || d.target.id == "c_" + g.m_id)
            }
        }
    })     // On récupère les parents
        .style("marker-end", function () { return 'url(#arrowHeadOutlow)'; })
        .style("stroke", INFLOW_COLOR)
        .style("opacity", 1);
}

export function fadeUnconnected(g) { // Il manque le cas des personnes célibataires
    var link = d3.svg.select("#links").selectAll("path.link")
        .data(biHiSankey.visibleLinks(), function (d) { return d.id; });
    link.filter(function (d) {
        if (d.source != null && d.target != null && g.parent != null) {
            return d.source !== g && d.source.id != g.parent.id && d.target !== g && d.target.id != g.parent.id && d.target.id != "c_" + g.f_id && d.target.id != "c_" + g.m_id;
        }
    })
        .style("marker-end", function () { return 'url(#arrowHead)'; })
        .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_FADED);

    var node = svg.select("#nodes").selectAll(".node")
        .data(biHiSankey.collapsedNodes(), function (d) { return d.id; });
    node.filter(function (d) {
        return !biHiSankey.connected(d, g) && !d.id.includes("c_") && d !== g;    // On fade les non-reliés
    }).transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.NODE_FADED);
}


export function restoreLinksAndNodes(nodes) {
    link
        .style("stroke", LINK_COLOR)
        .style("marker-end", function () { return 'url(#arrowHead)'; })
        .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", function (d) {
            return d.id.includes("c_") || isParentCelib(nodes, d) ? 1 : 0
        });
    node.filter(function (n) { return !n.id.includes("c_"); })
        .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", 1);
}

export function dealWithNodes() {
    var node = svg.select("#nodes").selectAll(".node")
        .data(biHiSankey.collapsedNodes(), function (d) { return d.id; });
    node.transition()
        .duration(TRANSITION_DURATION)
        .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
        .style("opacity", function (d) { return d.id.includes("c_") ? 1 : 0 })
        .select("circle")
        .style("fill", function (d) {
            d.color = colorScale(d.type.replace(/ .*/, ""));
            return d.color;
        })
        .style("fill", function (d) { return "url(#mImg_" + d.id + ")" })
        //.style("stroke", function (d) { return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1); })
        .style("stroke-WIDTH", "1px")
        .attr("height", function (d) { return d.height; })
        .attr("width", biHiSankey.nodeWidth());


    node.exit()
        .transition()
        .duration(TRANSITION_DURATION)
        .attr("transform", function (d) {
            var collapsedAncestor, endX, endY;
            collapsedAncestor = d.ancestors.filter(function (a) {
                return a.state === "collapsed";
            })[0];
            endX = collapsedAncestor ? collapsedAncestor.x : d.x;
            endY = collapsedAncestor ? collapsedAncestor.y : d.y;
            return "translate(" + endX + "," + endY + ")";
        })
        .remove();


    nodeEnter = node.enter().append("g").attr("class", "node");

    // Ne sont concerné ici que les noeuds uniques visible au départ
    nodeEnter
        .attr("transform", function (d) {
            var sX = 0;
            var sY = 0;
            if (d._parent) {
                sX = d._parent.x;
            }
            else if (d.children.length > 1) {
                sX = Math.max(d.children[0].x, d.children[1].x);
                sY = Math.max(d.children[0].y, d.children[1].y);
            }
            else {
                sX = d.x;
                sY = d.y;
            }
            return "translate(" + sX + "," + sY + ")";
        })
        .style("opacity", function (d) { return d.id.includes("c_") ? 0 : 1 })
        .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", function (d) { return d.id.includes("c_") ? 0 : 1 })
        .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

    addImage(nodeEnter);

    var circle = nodeEnter.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 24)
        .style("stroke", "black")
        .style("stroke-width", 0.5)
        .style("transform", "rotate(-90deg)")
        .style("fill", function (d) { return "url(#mImg_" + d.id + ")" });

    nodeEnter.append("text");

    node.on("click", function (g) {
        console.log("click sur " + g.prenom);
        //alert('on a tiré sur : '+g.prenom);
    })
    node.on("mouseover", function (g) {
        console.log("mouseoever sur " + g.id + " : " + g.prenom);
        if (!isTransitioning && !g.id.includes("c_")) {
            // restoreLinksAndNodes();
            highlightConnected(biHiSankey.nodes(), g);
            fadeUnconnected(g);
            // addImage(node);
            tooltip = d3.select("#tooltip")
            tooltip
                .transition()
                .duration(TRANSITION_DURATION)
                .style("opacity", 1).select(".titre_nom")
                .text(function () {
                    var info = g.name + "\n " + g.prenom;
                    return info;
                });
            // On ajoute l'image récupérée sur github :     
            tooltip.transition().style("opacity", 1).select(".cimg").attr("src", 'https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/portraits/' + g.id + '.jpg');


            tooltip
                .transition()
                .duration(TRANSITION_DURATION)
                .style("opacity", 1).select(".value")
                .text(function () {
                    var nomsCouples = '';
                    var additionalInstructions = g.children.length ? "\n " + g.dMar ? "\n Date de mariage : " + formatDate(g.dMar) : "" + "(Double clic pour ouvrir)" : ("\n Date de naissance : " + (g.dBirth ? formatDate(g.dBirth) : "non renseignée") + (g.dDie ? ("\n Date de décès : " + formatDate(g.dDie)) : "") + "\n Profession : " + (g.job ? g.job : "non renseignée") + "\n " + (g.comm ? g.comm : " - "));
                    if (g.children.length) {
                        var nomC1 = g.children[0].name + ' ' + g.children[0].prenom;
                        var nomC2 = g.children[1].name + ' ' + g.children[1].prenom;
                        nomsCouples = nomC1 + '\n' + nomC2;
                    }
                    else {
                        nomsCouples = g.name + ' ' + g.prenom;
                    }
                    return additionalInstructions;
                });
            // On ajoute l'image récupérée sur github :     
            // tooltip.transition().style("opacity",1).select(".cimg").attr("src",'https://raw.githubusercontent.com/samueldb/samueldb.github.io/master/images/portraits/'+g.id+'.jpg');
        }
    });

    node.on("mouseleave", function () {
        if (!isTransitioning) {
            hideTooltip();
            restoreLinksAndNodes(biHiSankey.nodes());
            addImage(node);
        }
    });

    // allow nodes to be dragged to new positions
    node.call(d3.drag()
        .origin(function (d) { return d; })
        .on("dragstart", function () { this.parentNode.appendChild(this); })
        .on("drag", dragmove));

    // Ajouter du texte sur les noeuds
    node.filter(function (d) {
        return d.value > -1;
        //return true;
    }) // ici, on peut filter les noms des noeuds auxquels seront ajouté les textes
        .select("text")
        .attr("x", function (d) { return d.width; })
        .attr("y", function (d) { return d.height; })
        .attr("dy", ".35em")
        .attr("text-anchor", "bottom")
        .attr("transform", "rotate(225) translate(5,-15)") //function (d) { return d.height; }+");")
        .text(function (d) {
            var txt = "";
            if (d.name.includes(" ") || d.name.includes("-")) {
                var index = d.name.indexOf(" ");
                if (index == -1) {
                    index = d.name.indexOf("-");
                }
                txt = d.prenom + " " + d.name[0] + "." + d.name[index + 1] + ".";
            }

            else {
                txt = d.prenom + " " + d.name[0] + ".";
            }
            return txt;
        })
        .filter(function (d) { return d.x < WIDTH / 2; })
        .attr("x", 6 + biHiSankey.nodeWidth())
        .attr("text-anchor", "start");



    //node.attr("rotateZ","90deg");
    node.attr("id", function (d) { return d.id; });
    collapser = svg.select("#collapsers").selectAll(".collapser")
        .data(biHiSankey.expandedNodes(), function (d) { return d.id; });


    collapserEnter = collapser.enter().append("g").attr("class", "collapser");

    collapserEnter.append("circle")
        .attr("r", COLLAPSER.RADIUS)
    // .style("fill", function (d) {
    //   d.color = colorScale(d.type.replace(/ .*/, ""));
    //   return d.color;
    // });

    collapserEnter
        .style("opacity", function (d) { return d.id.includes("c_") ? 0 : 1 })
        .attr("transform", function (d) {
            return "translate(" + (d.x + d.width / 2) + "," + (d.y + COLLAPSER.RADIUS) + ")";

        });

    //collapserEnter.on("dblclick", showHideChildren);

    collapser.select("circle")
        .attr("r", COLLAPSER.RADIUS);

    collapser.transition()
        .delay(TRANSITION_DURATION)
        .duration(TRANSITION_DURATION)
        .attr("transform", function (d, i) {
            return "translate("
                + (COLLAPSER.RADIUS + i * 2 * (COLLAPSER.RADIUS + COLLAPSER.SPACING))
                + ","
                + (-COLLAPSER.RADIUS - OUTER_MARGIN)
                + ")";
        });

    collapser.on("mouseenter", function (g) {
        if (!isTransitioning) {
            showTooltip().select(".value")
                .text(function () {
                    var nomsCouples = '';
                    if (g.children.length) {
                        var nomC1 = g.children[0].name + ' ' + g.children[0].prenom;
                        var nomC2 = g.children[1].name + ' ' + g.children[1].prenom;
                        nomsCouples = nomC1 + '\n' + nomC2;
                    }
                    else {
                        nomsCouples = g.name + ' ' + g.prenom;
                    }
                    return nomsCouples + "\n(Double clic pour refermer)";
                });

            var highlightColor = highlightColorScale(g.type.replace(/ .*/, ""));

            // d3.select(this)
            //   .style("opacity", OPACITY.NODE_HIGHLIGHT)
            //   .select("rect")
            //     .style("fill", highlightColor);

            //   node.filter(function (d) {
            //   return (d.target === g) ? false : !biHiSankey.connected(d, g);
            // }).style("opacity", OPACITY.NODE_HIGHLIGHT)
            //     .select("rect")
            //       .style("fill", highlightColor);

            node.filter(function (d) {
                return (d.arbre != '1' || d.arbre != '2')
            }).style("opacity", function (d) { return d.id.includes("c_") ? 0 : 1 });
            //                .select("rect")
            //                  .style("fill", "url(#mImg)");
        }
    });

    collapser.on("mouseleave", function (g) {
        if (!isTransitioning) {
            hideTooltip();
            addImage(collapser);
            //  d3.select(this)
            //    .style("opacity", function(d){return d.id.includes("c_") ? 0:1})
            //    .select("rect")
            //      .style("fill","url(#mImg)");
            //
            //  node.filter(function (d) {
            //      return (d.source === g) ? false : !biHiSankey.connected(d, g);
            //    }).style("opacity", function(d){return d.id.includes("c_") ? 0:1})
            //        .select("rect")
            //          .style("fill", "url(#mImg)");
        }
    });

    collapser.exit().remove();
}