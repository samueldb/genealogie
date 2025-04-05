import {nest} from "d3-collection";
import * as d3 from "d3";
import $ from "jquery";
import * as utils_tree from './utils_tree.js';

export function biHiSankey() {
    //"use strict";

    var biHiSankey = {},
      nodeWidth = 18,
      nodeSpacing = 50,
      linkSpacing = 1,
      arrowheadScaleFactor = 0.5, // Specifies the proportion of a link's stroke width to be allowed for the marker at the end of the link.
      size = [5, 1], // default to one pixel by one pixel
      nodes = [],
      nodeMap = {},
      parentNodes = [],
      leafNodes = [],
      links = [],
      xScaleFactor = 5,
      yScaleFactor = 1,
      defaultLinkCurvature = 0.5;

    function center(node) {
      return node.y + node.height / 5;
      // return 0;
    }

    function value(link) {
      return link.value;
    }

    function initializeNodeArrayProperties(node) {
      node.sourceLinks = [];
      node.rightLinks = [];
      node.targetLinks = [];
      node.leftLinks = [];
      node.connectedNodes = [];
      node.children = [];
      node.ancestors = [];
    }
    
    // generates the nodeMap {"1": <node1>, "2": <node2>}
    // and initializes the array properties of each node
    function initializeNodeMap() {
      nodes.forEach(function (node) {
        nodeMap[node.id] = node;
        initializeNodeArrayProperties(node);
      });
    }

    function computeLeafNodes() {
      leafNodes = nodes.filter(function (node) {
        return !node.children.length;
      });
    }

    function computeParentNodes() {
      parentNodes = nodes.filter(function (node) {
        return node.children.length;
      });
    }

    function addAncestorsToChildren(node) {
      node.children.forEach(function (child) {
        child.ancestors = child.ancestors.concat(this.ancestors.concat([this]));
        addAncestorsToChildren(child);
      }, node);
    }
    
    // generate hierarchical connections between parent and child nodes
    function computeNodeHierarchy() {
      var parent,
          rootNodes = [];

      nodes.forEach(function (node) {
        parent = nodeMap[node.parent];
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
        } else {
          node.parent = null;
          rootNodes.push(node);
        }
      });

      computeLeafNodes();
      computeParentNodes();

      rootNodes.forEach(function (rNode) {
        addAncestorsToChildren(rNode);
      });
    }

    // Populate the sourceLinks and targetLinks for each node.
    function computeNodeLinks() {
      var sourceNode, targetNode;
      links.forEach(function (link) {                         // Gérer le cas des liens entre personnes d'un couple
              if (typeof(link) != 'undefined'){
                  sourceNode = nodeMap[link.source] || link.source;
                  targetNode = nodeMap[link.target] || link.target;
                  link.id = link.source + '-' + link.target;
                  link.source = sourceNode;
                  link.target = targetNode;
                  sourceNode.sourceLinks.push(link);
                  targetNode.targetLinks.push(link);
            }
          });
    }

    function visible(linkCollection) {
      return linkCollection.filter(function (link) {
        return (link.source.state === "collapsed" || link.target.state === "expanded")       // Gestion de l'affichage des liens pour ne pas voir les liens parents->enfants autre que ceux passant par le couple
              && ((!link.source.id.includes("c_") && link.target.id.includes("c_") && link.source.x == link.target.x) 
                  || (link.source.id.includes("c_") && !link.target.id.includes("c_"))
                  || (utils_tree.isParentCelib(biHiSankey.nodes(), link) && !link.target.id.includes("c_"))      // Cas des parents célibataires
                  );
      });
    }

    // When child nodes are collapsed into their parents (or higher ancestors)
    // the links between the child nodes should be represented by links
    // between the containing ancestors. This function adds those extra links.
    function computeAncestorLinks() {
      // Leaf nodes are never parents of other nodes
      // Duplicate source and target links between a leaf node and another leaf node
      // and add to the leaf nodes' parents
      leafNodes.forEach(function (leafNode) {
        leafNode.sourceLinks.forEach(function (sourceLink) {
          var ancestorTargets,
          target = sourceLink.target;
          if (leafNodes.indexOf(target) >= 0) {
            ancestorTargets = target.ancestors.filter(function (tAncestor) {
              return leafNode.ancestors.indexOf(tAncestor) < 0;
            });
            ancestorTargets.forEach(function (ancestorTarget) {
              var ancestorLink = { source: leafNode,
                                  target: ancestorTarget,
                                  value: sourceLink.value,
                                  id: leafNode.id + "-" + ancestorTarget.id };

              leafNode.sourceLinks.push(ancestorLink);
              ancestorTarget.targetLinks.push(ancestorLink);
              links.push(ancestorLink);
            });
          }
        });

        leafNode.targetLinks.forEach(function (targetLink) {
          var ancestorSources, source = targetLink.source;
          if (leafNodes.indexOf(source) >= 0) {
            ancestorSources = source.ancestors.filter(function (sAncestor) {
              return leafNode.ancestors.indexOf(sAncestor) < 0;
            });
            ancestorSources.forEach(function (ancestorSource) {
              var ancestorLink = { source: ancestorSource,
                                  target: leafNode,
                                  value: targetLink.value,
                                  id: ancestorSource.id + "-" + leafNode.id };
              ancestorSource.sourceLinks.push(ancestorLink);
              leafNode.targetLinks.push(ancestorLink);
              links.push(ancestorLink);
            });
          }
        });
      });

      // Add links between parents (for when both parents are in collapsed state)
      parentNodes.forEach(function (parentNode) {
        parentNode.sourceLinks.forEach(function (sourceLink) {
          var ancestorTargets, target = sourceLink.target;
          if (leafNodes.indexOf(target) >= 0) {
            ancestorTargets = target.ancestors.filter(function (tAncestor) {
              return parentNode.ancestors.indexOf(tAncestor) < 0;
            });
            ancestorTargets.forEach(function (ancestorTarget) {
              var ancestorLink = { source: parentNode,
                                  target: ancestorTarget,
                                  value: sourceLink.value,
                                  id: parentNode.id + " -> " + ancestorTarget.id };

              parentNode.sourceLinks.push(ancestorLink);
              ancestorTarget.targetLinks.push(ancestorLink);
              links.push(ancestorLink);
            });
          }
        });
      });
    }

    // To reduce clutter in the diagram merge links that are from the                  
    // same source to the same target by creating a new link                           
    // with a value equal to the sum of the values of the merged links                 
    function mergeLinks() {                                                            
      var linkGroups = nest()
        .key(function (link) { return link.source.id + "->" + link.target.id; })       
        .entries(links)                                                                
        .map(function (object) { return object.values; });
    }

    // Calcul la hauteur de chaque noeuds
    function nodeHeight(sideLinks) {
      var spacing = Math.max(sideLinks.length - 1, 0) * linkSpacing,
          scaledValueSum = (d3.sum(sideLinks, value) * yScaleFactor) / 6;
      return scaledValueSum + spacing;
    }

    // Compute the value of each node by summing the associated links.
    // Compute the number of spaces between the links
    // Compute the number of source links for later decrementing
    function computeNodeValues() {
      nodes.forEach(function (node) {
        node.value = Math.max(                // node.value modifie la largeur du lien
          d3.sum(node.leftLinks, value),
          d3.sum(node.rightLinks, value)
        );
        node.netFlow = 1;
        node.height = Math.max(nodeHeight(visible(node.leftLinks)), nodeHeight(visible(node.rightLinks)));
        //node.linkSpaceCount = Math.max(Math.max(node.leftLinks.length, node.rightLinks.length) - 1, 0);
        node.linkSpaceCount = 1;
      });
    }

    function computeConnectedNodes() {
      var sourceNode, targetNode;
      links.forEach(function (link) {
          sourceNode = link.source;
          targetNode = link.target;
          sourceNode.connectedNodes.push(targetNode);
          targetNode.connectedNodes.push(sourceNode);
        });
    }

    function sourceAndTargetNodesWithSameX() {            // Dans une même génération donc
      var nodeArray = [];
      links.filter(function (link) {
        return link.target.x === link.source.x;
      }).forEach(function (link) {
        if (nodeArray.indexOf(link.target) < 0) {
          nodeArray.push(link.target);
        }
      });
      return nodeArray;
    }

    function compressInXDirection() {
      var connectedNodesXPositions,
          nodesByXPosition = nest()
            .key(function (node) { return node.x; })
            .sortKeys(d3.ascending)
            .entries(nodes)
            .map(function (object) { return object.values; });

      nodesByXPosition.forEach(function (xnodes) {
        xnodes.forEach(function (node) {
          connectedNodesXPositions = node.connectedNodes.map(function (connectedNode) {
            return connectedNode.x;
          });
          // keep decrementing the x value of the node
          // unless it would have the same x value as one of its source or target nodes
          // or node.x is already 0
          while (node.x > 0 && connectedNodesXPositions.indexOf(node.x - 1) < 0) {
            node.x -= 1;
          }
          node.x = node.x;
        });
      });
    }

    function scaleNodeXPositions() {
      var minX = d3.min(nodes, function (node) { return node.x; }),
          maxX = d3.max(nodes, function (node) { return node.x; }); // - minX;
      xScaleFactor = (size[0] - nodeWidth) / maxX;

      nodes.forEach(function (node) {
        node.x *= xScaleFactor;
      });
    }

    function computeNodeXPositions() {
    // 1ère exposition des X
      var remainingNodes = nodes,
          nextNodes,
          x = 0,
          addToNextNodes = function (link) {
            if (nextNodes.indexOf(link.target) < 0 && link.target.x === this.x) {
              nextNodes.push(link.target);
            }
          },
          setValues = function (node) {
              node.x = x;
              node.width = nodeWidth;
              if (node.sourceLinks){          // on teste l'existence de sourceNode par rapport aux ajout du filtre ligne 212
                  node.sourceLinks.forEach(addToNextNodes, node);
              }
          };

      while (remainingNodes.length) {
        nextNodes = [];
        remainingNodes.forEach(setValues);
        if (nextNodes.length) {
          remainingNodes = nextNodes;
        } else {
          remainingNodes = sourceAndTargetNodesWithSameX();
        }
        x += 1;
      }

      //compressInXDirection();
      scaleNodeXPositions();
    }

    function computeLeftAndRightLinks() {
      var source, target;
      nodes.forEach(function (node) {
        node.rightLinks = [];
        node.leftLinks = [];
      });
      links.forEach(function (link) {
        source = link.source;
        target = link.target;
        if (source.x < target.x) {
          source.rightLinks.push(link);
          target.leftLinks.push(link);
          link.direction = 1;
        } else {
          source.leftLinks.push(link);
          target.rightLinks.push(link);
          link.direction = -1;
        }
      });
    }

    function adjustTop(adjustment) {
      nodes.forEach(function (node) {
        node.y -= adjustment;
      });
    }
    
    // Calcul de la taille du lien
      function calculateLinkThickness() {
        links.forEach(function (link) {
          link.thickness = link.value * yScaleFactor / 6;

        });
      }

    function computeNodeYPositions(iterations) {
      var minY,
          alpha,
          nodesByXPosition = nest()
            .key(function (node) { return node.x; })
            .sortKeys(d3.ascending)
            .entries(nodes)
            .map(function (object) { return object.values; });

      function calculateYScaleFactor() {
        var linkSpacesCount, nodeValueSum, discretionaryY;
        yScaleFactor = d3.min(nodesByXPosition, function (nodes) {
          linkSpacesCount = d3.sum(nodes, function (node) {
            return node.linkSpaceCount;
          });
          nodeValueSum = d3.sum(nodes, function (node) {return node.value;});
          discretionaryY = (size[1]
                          - (nodes.length - 1) * nodeSpacing
                          - linkSpacesCount * linkSpacing);

          return  discretionaryY / nodeValueSum;
        });

        // Fat links are those with lengths less than about 4 times their heights
        // Fat links don't bend well
        // Test that yScaleFactor is not so big that it causes "fat" links; adjust yScaleFactor accordingly
        links.forEach(function (link) {
          var linkLength = Math.abs(link.source.x - link.target.x),
              linkHeight = link.value * yScaleFactor;
          if (linkLength / linkHeight < 4) {
            yScaleFactor = 0.5 * linkLength / link.value;
          }
        });
      }
                                                                                                       // calcul de la position verticale
      function initializeNodeYPosition() {           

      function ascendingYancPosition(a, b) {
          return a.yAnc - b.yAnc;
        }
      function ascendingYPosition(a, b) {
          return a.y - b.y;
        }
        
        // Retourne les éléments d'unique ID d'une table
        function multiDimensionalUnique(arr) {
          var uniques = [];
          var itemsFound = {};
          for(var i = 0, l = arr.length; i < l; i++) {
              var stringified = JSON.stringify(arr[i].id);
              if(itemsFound[stringified]) { continue; }
              uniques.push(arr[i]);
              itemsFound[stringified] = true;
          }
          return uniques;
      }

      function ascendingNodeXPosition(a, b) {
          return a[0].x - b[0].x;
        }
        
        
      nodesByXPosition.forEach(function (nodes) {
             nodes.forEach(function (node, i) {
                 if (node.x == 0){
                       node.y = i*10;                                                                                // calcul de la position verticale
                       node.heightAllowance = node.value * yScaleFactor + linkSpacing * node.linkSpaceCount;  
                   }
                   else {
                     node.y = 0;
                      //node.heightAllowance = node.value * yScaleFactor + linkSpacing * node.linkSpaceCount;  
                      node.heightAllowance = node.value * yScaleFactor;// + linkSpacing * node.linkSpaceCount;  
                   }
                     //i++;// calcul de la position verticale
              });
          });
          var generation = 0;
          //nodesByXPosition contient un tableau par X, soit un tableau par génération en commençant par les plus jeunes (donc on inverse le tableau pour partir des plus vieux)
          // Il faut qu'on trie les descendants en fonction du y de leur ancetre
          var nodesGenerationXclasses = nodesByXPosition.sort(ascendingNodeXPosition);
          for (var tabGeneration of nodesGenerationXclasses){
              if(generation > 0){
                  // On récupère les ancêtres :
                 var tabYancestors = [];
                 for (var node of tabGeneration){
                     if (node.y == 0 && !node.type.includes("couple")){
                         // on remplit le tableau avec l'id, le y de l'ancetre et le y que l'on calculera
                         // connectedAncetres contient tous les ancetres du noeuds node
                         var connectedAncetres = node.connectedNodes.filter(function (bn){return bn.x < node.x;});
                         if (connectedAncetres.length > 1){
                              // on a donc 2 grands parents : 
                              node.y = (connectedAncetres[0].y + connectedAncetres[1].y)/2;
                         }
                         else if (connectedAncetres.length == 1){
                          // on a qu'un seul grand parent : 
                              node.y = connectedAncetres[0].y;
                         }
                         else {
                          // on a a priori aucun grand parent : 
                              node.y = 'undefined';
                         }
                     }
                 }
              // Pour tous ceux qui ont des ancêtres, on leur donne le yVoulu
              var tabTrieparYAnc = tabYancestors.sort(ascendingYancPosition);
              var i = tabGeneration.max()=='undefined' ? 0:tabGeneration.max()+1;
              for (var node of tabGeneration){
                  var conjoint = tabGeneration.find(function(a){return a.c_id == node.id});
                  if (node.y == 'undefined' && conjoint.y != 'undefined'){
                      node.y = conjoint.y;
                  }
                  else if (node.y == 'undefined' && node.id.includes('c_')){
                      node.y = i;
                  }
              }
              
               //  // On rassemble les couples 
                 var tabHomme = tabGeneration.filter(function (a){return (a.type == "M" && !a.id.includes("c_")) || (a.type == "F" && (a.c_id == "" || a.c_id == "null" ||a.c_id == null))});
                 var tabFemme = tabGeneration.filter(function (a){return a.type == "F" && !a.id.includes("c_")});
                 var tabFinalYClasse = tabHomme.sort(ascendingYPosition);
                 // On va ajouter les femmes au tableau des hommes :
                 for (var nodeH of tabFinalYClasse){
                      if ((nodeH.c_id != null && nodeH.c_id != "null" && nodeH.c_id != "")){
                          var saFemme = tabFemme.find(function(a){return a.c_id == nodeH.id});
                          // on ajoute à l'index voulu :
                          if (saFemme != 'undefined' && saFemme != undefined){
                              tabFinalYClasse.splice(tabFinalYClasse.indexOf(nodeH)+1, 0, saFemme);
                          }
                      }
                 }
                 // Maintenant qu'on a un tableau trié, on réassigne les y suivant la position du tableau : 
                 var ajout = 0;
                 for (var n of tabFinalYClasse){
                      //n.y = tabFinalYClasse.indexOf(n);
                      n.y = ajout;
                      ajout++;
                 }
                 // On vérifie qu'on a oublié personne :
                 for (var node of tabGeneration){
                      if(tabFinalYClasse.find(function (a){return a === node;})){
                          // Pas besoin de l'ajouter à nouveau
                      }
                      else {tabFinalYClasse.push(node);}
                 }
                  tabGeneration = tabFinalYClasse;
                  
               // Il faut itérer sur les couples pour moyenner leurs Y afin qu'ils se trouvent à la même place
                 var tabCouple = tabGeneration.filter(function (a){return a.id.includes("c_")}); // On ne gère que les points "Couple"
                 for (var c of tabCouple){
                     var homme = tabGeneration.find(function (a){return a.id == c.id_homme});
                     var femme = tabGeneration.find(function (a){return a.id == c.id_femme});
                     c.y = (homme.y + femme.y) / 2;
                     c.x = homme.x;
                 }
              }
              if (generation == 0){
                  // On rassemble les couples pour la 1ère génération
                  var tabHomme = tabGeneration.filter(function (a){return a.type == "M"  && !a.id.includes("c_")});
                  var tabFemme = tabGeneration.filter(function (a){return a.type == "F"  && !a.id.includes("c_")});
                  tabHomme.forEach(function (nodeH, h) {
                      nodeH.y = h;
                      //nodeH.x = generation;
                      if ((nodeH.c_id != null && nodeH.c_id != "null")){
                          var saFemme = tabFemme.find(function(a){return a.c_id == nodeH.id});
                          saFemme.y = h + 1;
                          //saFemme.x = generation;
                          h ++;
                      }
                  });
                  // Il faut itérer sur les couples pour moyenner leurs Y afin qu'ils se trouvent à la même place
                  var tabCouple = tabGeneration.filter(function (a){return a.id.includes("c_")});
                  for (var c of tabCouple){
                      var homme = tabGeneration.find(function (a){return a.id == c.id_homme});
                      var femme = tabGeneration.find(function (a){return a.id == c.id_femme});
                      c.y = (homme.y + femme.y) / 2;
                      c.x = homme.x;
                  }
              }
              generation = generation + 1;
          }
          
          // A ce niveau, les gens sont correctement placés sur l'arbre. 
          // Maintenant, nous voulons qu'ils soient le plus possible placé en fonction de leurs ancêtre de manière "droite", "direct", que le tronc soit le plus droit possible
          //1. on cherche la génération comportant le plus d'enfant sans couple
          //2. on recalcule la position des parents et des enfants en fonction de la place des gens sur la génération la plus nombreuse
          var geneLaPlusNombreuse = 0;
          var maxLength = 0;
          for (var i = 0;i<nodesGenerationXclasses.length;i++){
              if (nodesGenerationXclasses[i].length > maxLength){
                  maxLength = nodesGenerationXclasses[i].filter(function(n){return n.type != "couple";}).length;
                  geneLaPlusNombreuse = i;
              }
          }
          
          var tabGenePlusNombreuse = nodesGenerationXclasses[geneLaPlusNombreuse].sort(ascendingYPosition);
          // On commence par traiter les générations plus récentes : 
          var generationN = geneLaPlusNombreuse + 1; // C'est la 1ère génération après la plus nombreuse
          //var generationN = 3; // C'est la 1ère génération après la plus nombreuse
          
          for (var gene = generationN;gene<nodesGenerationXclasses.length;gene++){
          //--Début classement des enfants par parents
          //for (var parent of nodesGenerationXclasses[gene-1]){
          //    //Pour chaque parent, on récupère les enfants : 
          //    var Enfants = nodesGenerationXclasses[gene].filter(function(n){return (n.f_id == parent.id && n.f_id != null)||(n.m_id == parent.id && n.m_id != null)});
          //    for (var e of Enfants){
          //        e.parentID = parent.id;
          //    }
          //}
          //var nodesByParents = d3.nest()      //nodesByParents contient un tableau d'enfants classés par parents
          //  .key(function (node) { return node.parentID; })
          //  .sortKeys(d3.ascending)
          //  .entries(nodesGenerationXclasses[gene])
          //  .map(function (object) { return object.values; });
          //      
          //--Fin classement des enfants par parents
              var tabGene = nodesGenerationXclasses[gene].sort(ascendingYPosition);
              for (var node of tabGene){
                  if (typeof(node.ytraiteok) != 'undefined'){
                  }
                  else {
                      if (node.type != 'couple'){
                          var FreresEtSoeurs = tabGene.filter(function (bn){return ((bn.m_id == node.m_id && bn.m_id != null) || (bn.f_id == node.f_id && bn.f_id != null));});   // Les frères et soeurs des enfants
                          var Parents = nodesGenerationXclasses[gene-1].filter(function (bn){return bn.id == node.m_id || bn.id == node.f_id;}); // gene-1 est la génération la plus nombreuse
                          //FreresEtSoeurs.add(node);
                          if (FreresEtSoeurs.length == 1){ // Le noeud est fils unique
                              var minYParents = d3.min(Parents, function (node) { return node.y; });
                              var maxYParents = d3.max(Parents, function (node) { return node.y; });
                              var meanYParents = (maxYParents + minYParents)/2;
                              var dy = meanYParents - node.y;
                              node.y += dy;
                              node.ytraiteok = 'ok';
                              // On déplace également le couple et le point du couple s'il existe : 
                              var encouple = tabGene.find(function(n){return n.c_id == node.id;});
                              if (typeof(encouple) != 'undefined'){
                                  var nodeCouple = tabGene.find(function(n){return n.id == "c_"+node.id || n.id == "c_"+encouple.id;});
                                  if (typeof(nodeCouple.ytraiteok) == 'undefined'){
                                      nodeCouple.y = dy;
                                      nodeCouple.ytraiteok = 'ok';
                                  }
                                  if (typeof(encouple.ytraiteok) == 'undefined'){
                                      encouple.y = dy;
                                      encouple.ytraiteok = 'ok';
                                  }
                              }
                              for (var autreNoeuds of tabGene.filter(function(n){return typeof(n.ytraiteok) == 'undefined'})){
                                  autreNoeuds.y += dy;
                              }
                          }
                          else if (FreresEtSoeurs.length > 1){  // Le noeud a des frères et soeurs
                              var minYFratrie = d3.min(FreresEtSoeurs, function (node) { return node.y; });
                              var maxYFratrie = d3.max(FreresEtSoeurs, function (node) { return node.y; });
                              var meanYFratrie = (maxYFratrie + minYFratrie)/2;
                              var minYParents = d3.min(Parents, function (node) { return node.y; });
                              var maxYParents = d3.max(Parents, function (node) { return node.y; });
                              var meanYParents = (maxYParents + minYParents)/2;
                              var dy = meanYParents - meanYFratrie;
                              for (var fratrie of FreresEtSoeurs.filter(function(n){return typeof(n.ytraiteok) == 'undefined'})){
                                  fratrie.y += dy;
                                  fratrie.ytraiteok = 'ok';
                                  // On déplace également le couple et le point du couple s'il existe : 
                                  var encouple = tabGene.find(function(n){return n.c_id == fratrie.id;});
                                  if (typeof(encouple) != 'undefined'){
                                      var nodeCouple = tabGene.find(function(n){return n.id == "c_"+fratrie.id || n.id == "c_"+encouple.id;});
                                      if (typeof(nodeCouple.ytraiteok) == 'undefined'){
                                          nodeCouple.y = meanYParents + dy;
                                          nodeCouple.ytraiteok = 'ok';
                                      }
                                      if (typeof(encouple.ytraiteok) == 'undefined'){
                                          encouple.y = meanYParents + dy;
                                          encouple.ytraiteok = 'ok';
                                      }
                                  }
                              }
                              for (var autreNoeuds of tabGene.filter(function(n){return typeof(n.ytraiteok) == 'undefined'})){
                                  autreNoeuds.y += dy;
                              }
                          }
                      }
                  }
              }
          }
          ////Puis les générations plus anciennes, en commençant par leurs parents : 
          var generationN = geneLaPlusNombreuse - 1;
          //for (var gene = generationN;gene>-1;gene--){
          for (var gene = generationN;gene>-1;gene--){
              var tabGene = nodesGenerationXclasses[gene].sort(ascendingYPosition);
              var minYDetermineOK = 0;        // Cette variable nous permet de ne pas nous occuper des personnes dont la position est déjà derrière les y traités
              var oldMinYDetermineOK = 0;
              for (var node of tabGene){
                  if (typeof (node.ytraiteok) == 'undefined'){
                      var Parents = tabGene.filter(function (bn){return bn.c_id == node.id || bn.id == node.id}); //Les max 2 parents à bouger
                      var Descendants = nodesGenerationXclasses[gene+1].filter(function (bn){return bn.m_id == node.id || bn.f_id == node.id;}); //De la génération "enfant"
                      if (Descendants.length == 0){ // Le noeud n'a pas de descendant
                          minYDetermineOK = node.y;
                          node.ytraiteok = 'ok';
                          oldMinYDetermineOK = minYDetermineOK;
                      }
                      else {
                          var minYFratrie = d3.min(Descendants, function (node) { return node.y; });
                          var maxYFratrie = d3.max(Descendants, function (node) { return node.y; });
                          var meanYFratrie = (maxYFratrie + minYFratrie)/2;
                          var minYParents = d3.min(Parents, function (node) { return node.y; });
                          var maxYParents = d3.max(Parents, function (node) { return node.y; });
                          var meanYParents = (maxYParents + minYParents)/2;
                          var dy = meanYFratrie - meanYParents;
                          if (minYParents+dy<minYDetermineOK){    // Si le décalage revient sur des éléments déjà positionné, on ne déplace pas le noeuds, par contre, on replace ses descendants. 
                              for (var parent of Parents){    
                                  parent.ytraiteok = 'ok';
                                  var nodeCouple = tabGene.find(function(n){return n.id == "c_"+Parents[0].id || n.id == "c_"+Parents[1].id;});
                                  nodeCouple.ytraiteok = 'ok';
                                  minYDetermineOK = maxYParents;
                              }
                              var dyDesc = meanYParents - meanYFratrie;
                              var IDdescendantsLarges = [];
                              for (var descendant of Descendants){
                                  IDdescendantsLarges.push(descendant.id);
                                  descendant.y += dyDesc;
                                  var encouple = nodesGenerationXclasses[gene+1].find(function(n){return n.c_id == descendant.id || n.id == descendant.c_id;});
                                  if (typeof(encouple) != 'undefined'){ 
                                      encouple.y +=dyDesc;
                                      var pointCouple = nodesGenerationXclasses[gene+1].find(function(n){return n.id == "c_"+descendant.id || n.id == "c_"+descendant.c_id;});
                                      pointCouple.y += dyDesc; // point couple
                                      IDdescendantsLarges.push(encouple.id);
                                      IDdescendantsLarges.push(pointCouple.id);
                                  }
                              }
                              // Il faut appliquer ce traitement à tous les noeuds de la géné n+1 qui sont impactés par le déplacement des descendants
                              var noeudsImpactes = nodesGenerationXclasses[gene+1].filter(function(n){return n.y > minYFratrie + dyDesc;});
                              //descendantsLarges = nodesGenerationXclasses[gene+1].filter(function (bn){return bn.m_id == node.id || bn.f_id == node.id || bn.c_id == node.id || bn.id == node.c_id || bn.id == "c_" + node.id;})
                              // on retranche les descendants à ce tableau
                              var noeudsImpactesAllege = [];
                              for (var no of noeudsImpactes){
                                  if ($.inArray(no.id,IDdescendantsLarges) == -1){
                                      noeudsImpactesAllege.push(no);
                                  }
                              }
                              
                              if (noeudsImpactesAllege.length > 0){
                                  for (var descendant of noeudsImpactesAllege){
                                      descendant.y += dyDesc;
                                  }
                              }
                          }
                          else{
                              for (var parent of Parents){
                                  parent.y += dy;
                                  parent.ytraiteok = 'ok';
                              }
                              // On déplace également le point du couple s'il existe : 
                              if (Parents.length > 1){
                                          var nodeCouple = tabGene.find(function(n){return n.id == "c_"+Parents[0].id || n.id == "c_"+Parents[1].id;});
                                          nodeCouple.y = meanYParents + dy;
                                          nodeCouple.ytraiteok = 'ok';
                              }
                          }
                          
                          var rad = tabGene.filter(function(n){return typeof(n.ytraiteok) == 'undefined' && n.y > oldMinYDetermineOK});
                          var radID = [];
                          for (var r of rad){
                              radID.push(r.id);
                          }
                          var coupure = 0; // coupure nous sert à déterminer si le début de l'enclenchement est sous le minYDetermineOK. Si c'est le cas, on ne bouge plus rien, le reste de la boucle for (node) s'en chargera
                          for (var autreNoeuds of rad){
                              if (autreNoeuds.y + dy>minYDetermineOK && coupure == 0){
                                  autreNoeuds.y += dy;
                                  // Si son couple n'est pas dans le filtre, on le bouge quand même aussi : 
                                  var encouple = tabGene.find(function(n){return n.c_id == autreNoeuds.id;});
                                  if (typeof(encouple) != 'undefined' && $.inArray( encouple.id, radID ) != -1){ // rien
                                  }
                                  else if (typeof(encouple) != 'undefined'){
                                      encouple.y += dy;
                                  }
                              }
                              else {
                                  coupure = 1;
                              }
                          }
                      }
                  }
              var test = 'ok';
              }
              var resteADetermine = tabGene.filter(function(n){return typeof(n.ytraiteok) == 'undefined' && n.y > minYDetermineOK});
              if (resteADetermine.length > 0){ // Il reste à traiter les noeuds sans descendance
                  for (var node of resteADetermine){
                      if (typeof (node.ytraiteok) == 'undefined'){
                          // On cherche tout ses frères & soeurs                                                                                                      
                          var FetS = tabGene.filter(function (bn){return (bn.m_id != null && bn.m_id == node.m_id) || (bn.f_id != null && bn.f_id == node.f_id);});
                          // On détermine la ou l'écart en Y est le plus important
                          var ecart = 0;
                          var frere = FetS[0];
                          for (var i=0;i<FetS.length-1;i++){
                              var dd = FetS[i+1].y - FetS[i].y;
                              if (dd > ecart){ecart = dd;}
                              frere = FetS[i+1];
                          }
                          // On vérifie que la personne a au moins 1 de ces parents de renseigné (sinon, c'est une pièce rapportée dont le cas est traité par le 'encouple'
                          if (node.m_id == 'null' && node.f_id == 'null'){
                          }
                          else {
                              // On le case entre ces 2 personnes
                              var encouple = tabGene.find(function(n){return n.c_id == node.id;});
                              var delta = 0;
                              if (typeof(encouple) != 'undefined'){
                                  delta = node.y - encouple.y;
                                  node.y = frere.y + ecart/2;
                                  encouple.y = frere.y + delta + ecart/2;
                                  encouple.ytraiteok = 'ok';
                                  var nodeCouple = tabGene.find(function(n){return n.id == "c_"+node.id || n.id == "c_"+encouple.id;});
                                  if (typeof(nodeCouple) != 'undefined'){
                                      nodeCouple.y = (node.y + encouple.y)/2;
                                      nodeCouple.ytraiteok = 'ok';
                                  }
                              }
                              else {
                                  node.y = frere.y + ecart/2;
                              }
                          }
                      }
                  }
              }
          }
          
      }
      function ascendingYPosition(a, b) {
          return a.y - b.y;
      }
      function descendingYPosition(a, b) {
          return b.y - a.y;
      }
      /**
          isGeneConflit vérifie que sur une génération, tous les noeuds ont des places différentes
      */
      function isGeneConflit(tabGene,parent,nouvelDY){
          var tolerance = 0.2;
          var nouvelY = parent.y + nouvelDY;
          var tabYdejaPresent = [];
          var isinliste = 0;
          for (var node of tabGene){
              for (var i of tabYdejaPresent){
                  if (node.id == i.id){
                  // Si l'id est déjà dans cette liste, on ne l'ajoute pas
                  isinliste = 1;
                  return true;
                  }
              }
              if (isinliste == 0){
                  if (nouvelY < node.y+tolerance && nouvelY > node.y-tolerance && node.id != parent.id){
                      tabYdejaPresent.push(node);
                  }
              }
          }
          if (tabYdejaPresent.length == 0){
              return false;
          }
          else { return true;}
      }
      
      // Calcul de la taille du lien
      function calculateLinkThickness() {
        links.forEach(function (link) {
          link.thickness = link.value * yScaleFactor / 6;

        });
      }

      function relaxLeftToRight(alpha) {
        function weightedSource(link) {
          return center(link.source) * link.value;
        }

        nodesByXPosition.forEach(function (nodes) {
          nodes.forEach(function (node) {
            if (node.rightLinks.length) {
              var y = d3.sum(node.rightLinks, weightedSource) / d3.sum(node.rightLinks, value);
              node.y += (y - center(node)) * alpha;
            }
          });
        });
      }

      function relaxRightToLeft(alpha) {
        function weightedTarget(link) {
          return center(link.target) * link.value;
        }

        nodesByXPosition.slice().reverse().forEach(function (nodes) {
          nodes.forEach(function (node) {
            if (node.leftLinks.length) {
              var y = d3.sum(node.leftLinks, weightedTarget) / d3.sum(node.leftLinks, value);
              node.y += (y - center(node)) * alpha;
            }
          });
        });
      }

      function resolveCollisions() {              // Il y a qqch à faire ici pour que les y se répartissent mieux entre frères/soeurs/couples d'une même génération
        function ascendingYPosition(a, b) {
          return a.y - b.y;
        }
        nodesByXPosition.forEach(function (nodes) {
          var node,
              dy,
              y0 = 0,
              n = nodes.length,
              i;

          nodes.sort(ascendingYPosition);

          var cn = 0;
          
          for (i = 0; i < n; ++i) {
              node = nodes[i];
              node.y *= 85;
              dy = y0 - node.y;
              if (dy > 0) {
                  node.y += dy;
              }
              y0 = node.y + node.heightAllowance + 2*nodeSpacing;
          }
          
          // On rapproche les couples : 
          for (var node of nodes){
              if (cn>0 && cn<nodes.length-1 && node.type=='couple'){
                  var ancienY = nodes[cn-1].y;
                  var ecartAvt = node.y - ancienY;
                  var ecartApr = nodes[cn+1].y - node.y;
                  var nouvelYa = ancienY + (ecartAvt/3);
                  var nouvelYb = node.y + (ecartApr/3);
                  nodes[cn-1].y = nouvelYa;
                  nodes[cn+1].y = nouvelYb;
                  node.y = (nodes[cn-1].y + nodes[cn+1].y) / 2;
              }
              cn++;
          }
        });
      }

      calculateYScaleFactor();
      initializeNodeYPosition();
      calculateLinkThickness();
      resolveCollisions();

      // Je ne sais pas à quoi ça sert d'itérer la dessus... 
     for (alpha = 1; iterations > 0; --iterations) {
       alpha *= 0.5;
       resolveCollisions();
     }

      minY = d3.min(nodes, function (node) { return node.y; });
      //adjustTop(minY);
    }

    function computeLinkYPositions() {
      
      function ascendingLeftNodeYPosition(a, b) {
        var aLeftNode = (a.direction > 0) ? a.source : a.target,
            bLeftNode = (b.direction > 0) ? b.source : b.target;
        return aLeftNode.y - bLeftNode.y;
      }

      function ascendingRightNodeYPosition(a, b) {
        var aRightNode = (a.direction > 0) ? a.target : a.source,
            bRightNode = (b.direction > 0) ? b.target : b.source;
        return aRightNode.y - bRightNode.y;
      }

      nodes.forEach(function (node) {
        node.rightLinks.sort(ascendingRightNodeYPosition);
        node.leftLinks.sort(ascendingLeftNodeYPosition);
      });

      nodes.forEach(function (node) {
        var rightY = 0, leftY = 0;

        node.rightLinks.forEach(function (link) {
          if (link.direction > 0) {
            link.sourceY = rightY;
            if (link.target.state === "collapsed") {
              rightY += link.thickness + linkSpacing;
            }
          }
          else {
            link.targetY = rightY;
            if (link.source.state === "collapsed") {
              rightY += link.thickness + linkSpacing;
            }
          }
        });

        node.leftLinks.forEach(function (link) {
          if (link.direction < 0) {
            link.sourceY = leftY;
            if (link.target.state === "collapsed") {
              leftY += link.thickness + linkSpacing;
            }
          }
          else {
            link.targetY = leftY;
            if (link.source.state === "collapsed") {
              leftY += link.thickness + linkSpacing;
            }
          }
        });

      });
      
      calculateLinkThickness();
    }

  function computeAbsolutePositions() {

      //setNumberOfAncestors(); Commenter car très long à s'exécuter. Besoin sur click link pour rendre invisible des noeuds
      // On redefini ce qui était calculé par le traitement de base
      for (var node of nodes){
          node.width = biHiSankey.nodeWidth();
          node.dx = biHiSankey.nodeWidth();
          //node.state = "collapsed";
          if (node.id.includes("c_")){
              var h = nodes.find(function(n){return n.id == node.id_homme;});
              var f = nodes.find(function(n){return n.id == node.id_femme;});
              node.x = (h.x + f.x) / 2;
              node.y = (h.y + f.y) / 2;
              //node.state == "collapsed";
          }
      }
      };
      
      //on essaie de déterminer combien d'ancêtre a le noeud
      function setNumberOfAncestors(){
          var remainingNodes = nodes;
          var nextNodes = [];
          nodes.forEach(function(node){
              node.nbAncetre = 0;
          });
          while (remainingNodes.length > 0){
              nextNodes = [];
              remainingNodes.forEach(function (node) {
                      // Pour chaque noeuds, on regarde si il a des ancetres
                      if (node.targetLinks.length > 0){
                          // On compte le nombre d'ancetre (nb en lien)
                          node.nbAncetre = node.nbAncetre + 1;
                          node.sourceLinks.forEach(function (link) {
                              nextNodes.push(link.target);
                          });
                      }
                  });
              remainingNodes = nextNodes;
          }
      }
      
        biHiSankey.arrowheadScaleFactor = function (_) {
          if (!arguments.length) { return arrowheadScaleFactor; }
          arrowheadScaleFactor = +_;
          return biHiSankey;
        };

        biHiSankey.collapsedNodes = function () {
          return nodes.filter(function (node) { return node.state === "collapsed"; });
        };

        biHiSankey.connected = function (nodeA, nodeB) {
          return nodeA.connectedNodes.indexOf(nodeB) >= 0;
        };

        biHiSankey.expandedNodes = function () {
          return nodes.filter(function (node) { return node.state === "expanded"; });
        };

        biHiSankey.layout = function (iterations) {
          computeAbsolutePositions();
          computeLeftAndRightLinks();
          computeNodeValues();
          computeLinkYPositions();
          return biHiSankey;
        };

        biHiSankey.link = function () {
          var curvature = defaultLinkCurvature;

          function leftToRightLink(link) {
              //if (link.source.c_id == null || link.source.c_id == "null"){   // On ne rend visible que les liens entre couples et enfants, ou entre parent seul et enfants
                var arrowHeadLength = link.thickness * arrowheadScaleFactor,
                    straightSectionLength = (3 * link.thickness / 4) - arrowHeadLength,
                    x0 = link.source.x + link.source.width,
                    x1 = x0 + arrowHeadLength / 2,
                    x4 = link.target.x - straightSectionLength - arrowHeadLength,
                    xi = d3.interpolateNumber(x0, x4),
                    x2 = xi(curvature),
                    x3 = xi(1 - curvature),
                    y0 = link.source.y, // + link.sourceY + link.thickness / 2,
                    y1 = link.target.y; // + link.targetY + link.thickness / 2;
                return "M" + x0 + "," + y0
                     + "L" + x1 + "," + y0
                     + "C" + x2 + "," + y0
                     + " " + x3 + "," + y1
                     + " " + x4 + "," + y1
                     + "L" + (x4 + straightSectionLength) + "," + y1;
             //}
             //else {
             //   var arrowHeadLength = link.thickness * arrowheadScaleFactor,
             //       straightSectionLength = (3 * link.thickness / 4) - arrowHeadLength,
             //       x0 = link.source.x + link.source.width,
             //       x1 = x0 + arrowHeadLength / 2,
             //       x4 = link.target.x - straightSectionLength - arrowHeadLength,
             //       xi = d3.interpolateNumber(x0, x4),
             //       x2 = xi(curvature),
             //       x3 = xi(1 - curvature),
             //       y0 = link.source.y; // + link.sourceY + link.thickness / 2,
             //       y1 = link.target.y; // + link.targetY + link.thickness / 2;
             //       // link.thickness = 0;
             //   return "M" + x0 + "," + y0
             //        + "L" + x1 + "," + y0
             //        + "C" + x2 + "," + y0
             //        + " " + x3 + "," + y1
             //        + " " + x4 + "," + y1
             //        + "L" + (x4 + straightSectionLength) + "," + y1;
             //}
          }

          function rightToLeftLink(link) {
            var arrowHeadLength = link.thickness * arrowheadScaleFactor,
                straightSectionLength = link.thickness / 4,
                x0 = link.source.x + link.source.width,
                x1 = x0 - arrowHeadLength / 2,
                x4 = link.target.x + link.target.width + straightSectionLength + arrowHeadLength,
                xi = d3.interpolateNumber(x0, x4),
                x2 = xi(curvature),
                x3 = xi(1 - curvature),
                y0 = link.source.y, // + link.sourceY + link.thickness / 2,
                y1 = link.target.y;// + link.targetY + link.thickness / 2;
            return "M" + x0 + "," + y0
                 + "L" + x1 + "," + y0
                 + "C" + x2 + "," + y0
                 + " " + x3 + "," + y1
                 + " " + x4 + "," + y1
                 + "L" + (x4 - straightSectionLength) + "," + y1;
          }

          function link(d) {

                if (d.source.x < d.target.x) {
                  return leftToRightLink(d);
                }

                return rightToLeftLink(d);
            }

          link.curvature = function (_) {
            if (!arguments.length) { return curvature; }
            curvature = +_;
            return link;
          };

          return link;
        };

        biHiSankey.links = function (_) {
          if (!arguments.length) { return links; }
          links = _.filter(function (link) {
            return link.source !== link.target; // filter out links that go nowhere
          });
          return biHiSankey;
        };

        biHiSankey.linkSpacing = function (_) {
          if (!arguments.length) { return linkSpacing; }
          linkSpacing = +_;
          return biHiSankey;
        };

        biHiSankey.nodes = function (_) {
          if (!arguments.length) { return nodes; }
          nodes = _;
          return biHiSankey;
        };

        biHiSankey.nodeWidth = function (_) {
          if (!arguments.length) { return nodeWidth; }
          nodeWidth = +_;
          return biHiSankey;
        };

        biHiSankey.nodeSpacing = function (_) {
          if (!arguments.length) { return nodeSpacing; }
          nodeSpacing = +_;
          return biHiSankey;
        };

        biHiSankey.relayout = function () {
          computeLeftAndRightLinks();
          computeNodeValues();
          computeLinkYPositions();
          return biHiSankey;
        };

        biHiSankey.size = function (_) {
          if (!arguments.length) { return size; }
          size = _;
          return biHiSankey;
        };

        biHiSankey.visibleLinks = function () {
          return visible(links);
        };

        biHiSankey.initializeNodes = function (callback) {
          initializeNodeMap();
          computeNodeHierarchy();
          computeNodeLinks();
          computeAncestorLinks();
          mergeLinks();
          computeConnectedNodes();
          nodes.forEach(callback);
          computeAbsolutePositions();
          return biHiSankey;
        };

        return biHiSankey;
      };

export default biHiSankey();