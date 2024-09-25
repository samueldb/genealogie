//JavaScript

function init_tree(){
    explodingBusinessStyle(OrgChart);

    var chart = new OrgChart(document.getElementById("tree"), {
        // mouseScrool: FamilyTree.none,
        siblingSeparation: 120, //between 2 brothers
        subtreeSeparation: 150, //between 2 family
        template: 'john',
        nodeBinding: {
            field_0: "name",
            field_1: "born",
            id: "id",
            father: "fid",
            mother: "mid",
            img_0: "img",
        },
        miniMap: true,
        scaleInitial:OrgChart.match.boundary,
        nodeMenu: {
            edit: { text: 'Edit' },
            details: { text: 'Details' },
        },
        menu: {
            pdf: { text: "Export PDF" },
            png: { text: "Export PNG" },
            svg: { text: "Export SVG" },
            csv: { text: "Export CSV" }
        },
        nodeTreeMenu: true,
        // mouseScrool: FamilyTree.ctrlZoom,
        //     editForm: {
    //         titleBinding: "name",
    //         photoBinding: "photo",
    //         addMoreBtn: 'Add element',
    //         addMore: 'Add more elements',
    //         addMoreFieldName: 'Element name',
    //         generateElementsFromFields: false,
    //         elements: [
    //         { type: 'textbox', label: 'Full Name', binding: 'name' },
    //         { type: 'textbox', label: 'Email Address', binding: 'email' },
    //         [
    //             { type: 'textbox', label: 'Phone', binding: 'phone' },
    //             { type: 'date', label: 'Date Of Birth', binding: 'born' }
    //         ],
    //         [
    //             { type: 'select', options: [{ value: 'bg', text: 'Bulgaria' }, { value: 'ru', text: 'Russia' }, { value: 'gr', text: 'Greece' }], label: 'Country', binding: 'country' },
    //             { type: 'textbox', label: 'City', binding: 'city' },
    //         ],
    //         { type: 'textbox', label: 'Photo Url', binding: 'photo', btn: 'Upload' },
    //     ]
    // },
    });

    chart.load(populateNodes());

    chart.on('expcollclick', function (sender, isCollapsing, nodeId) {
        var node = chart.getNode(nodeId);
        var collapseIds = [];
        iterate(chart, node, collapseIds, nodeId);
        chart.expandCollapse(nodeId, [], collapseIds);
    });

    chart.on('render-link', function (sender, args) {
        if (args.cnode.ppid != undefined)
            args.html += '<use data-ctrl-ec-id="' + args.node.id + '" xlink:href="#heart" x="' + (args.p.xa) + '" y="' + (args.p.ya) + '"/>';
        if (args.cnode.isPartner && args.node.partnerSeparation == 30)
            args.html += '<use data-ctrl-ec-id="' + args.node.id + '" xlink:href="#heart" x="' + (args.p.xb) + '" y="' + (args.p.yb) + '"/>';
    });

    chart.onInit(() => {
    // chart.collapse(171 );
});
}

function explodingBusinessStyle(FamilyTree){
    FamilyTree.templates.john = Object.assign({}, OrgChart.templates.ana);
    FamilyTree.templates.john.assistanseLink = `<path stroke-linejoin=\"round\" stroke=\"#aeaeae\" stroke-width=\"2px\" fill=\"none\" d=\"M{xa},{ya} {xb},{yb} {xc},{yc} {xd},{yd} L{xe},{ye}\"/>"`
    FamilyTree.templates.john.defs = `<g transform=\"matrix(0.05,0,0,0.05,-12,-9)\" id=\"heart\"><path fill=\"#F57C00\" d=\"M438.482,58.61c-24.7-26.549-59.311-41.655-95.573-41.711c-36.291,0.042-70.938,15.14-95.676,41.694l-8.431,8.909  l-8.431-8.909C181.284,5.762,98.663,2.728,45.832,51.815c-2.341,2.176-4.602,4.436-6.778,6.778 c-52.072,56.166-52.072,142.968,0,199.134l187.358,197.581c6.482,6.843,17.284,7.136,24.127,0.654 c0.224-0.212,0.442-0.43,0.654-0.654l187.29-197.581C490.551,201.567,490.551,114.77,438.482,58.61z\"/><g>`
    FamilyTree.templates.john.expandCollapseSize = 0
    FamilyTree.templates.john.field_0 = `<text data-width=\"230\" style=\"font-size: 16px;font-weight:bold;\" fill=\"#aeaeae\" x=\"60\" y=\"135\" text-anchor=\"middle\">{val}</text>`
    FamilyTree.templates.john.field_1 = `<text data-width=\"150\" style=\"font-size: 13px;\" fill=\"#aeaeae\" x=\"60\" y=\"150\" text-anchor=\"middle\">{val}</text>`
    FamilyTree.templates.john.img_0 = `<image preserveAspectRatio=\"xMidYMid slice\" clip-path=\"url(#john_img_0)\" xlink:href=\"{val}\"  x=\"6\" y=\"6\"  width=\"108\" height=\"108\"></image>`
    FamilyTree.templates.john.link = `<path stroke-linejoin=\"round\" stroke=\"#aeaeae\" stroke-width=\"1px\" fill=\"none\" d=\"{rounded}\" />`
    FamilyTree.templates.john.linkAdjuster = {fromX: 0, fromY: 0, toX: 0, toY: 0}
    FamilyTree.templates.john.link_field_0 = `<text text-anchor=\"middle\" fill=\"#aeaeae\" data-width=\"290\" x=\"0\" y=\"0\" style=\"font-size:10px;\">{val}</text>`
    FamilyTree.templates.john.menuButton = `<div style=\"position:absolute;right:{p}px;top:{p}px; width:40px;height:50px;cursor:pointer;\" data-ctrl-menu=\"\"><hr style=\"background-color: #7A7A7A; height: 3px; border: none;\"><hr style=\"background-color: #7A7A7A; height: 3px; border: none;\"><hr style=\"background-color: #7A7A7A; height: 3px; border: none;\"></div>`
    FamilyTree.templates.john.node = `<use x=\"0\" y=\"0\" xlink:href=\"#circle\" />`
    FamilyTree.templates.john.nodeMenuButton = `<use data-ctrl-n-menu-id=\"{id}\" x=\"90\" y=\"50\" xlink:href=\"#base_node_menu\"/>`
    FamilyTree.templates.john.nodeTreeMenuButton = `<use data-ctrl-n-t-menu-id=\"{id}\" x=\"10\" y=\"10\" xlink:href=\"#base_tree_menu\"/>`
    FamilyTree.templates.john.nodeTreeMenuCloseButton = `<use data-ctrl-n-t-menu-c=\"\" x=\"10\" y=\"10\" xlink:href=\"#base_tree_menu_close\"/>`
    FamilyTree.templates.john.padding = [50, 20, 35, 20]
    FamilyTree.templates.john.pointer = `<g data-pointer=\"pointer\" transform=\"matrix(0,0,0,0,100,100)\"><radialGradient id=\"pointerGradient\"><stop stop-color=\"#ffffff\" offset=\"0\" /><stop stop-color=\"#C1C1C1\" offset=\"1\" /></radialGradient><circle cx=\"16\" cy=\"16\" r=\"16\" stroke-width=\"1\" stroke=\"#acacac\" fill=\"url(#pointerGradient)\"></circle></g>`
    FamilyTree.templates.john.ripple = {radius: 60, color: '#e6e6e6', rect: null}
    FamilyTree.templates.john.size = [120, 120]
    FamilyTree.templates.john.svg = `<svg class=\"{randId} {template}\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\"  style=\"display:block;\" width=\"{w}\" height=\"{h}\" viewBox=\"{viewBox}\">{content}</svg>`
    FamilyTree.templates.john.up = `<use x=\"110\" y=\"-10\" xlink:href=\"#base_up\"/>`;

    FamilyTree.templates.john_male = Object.assign({}, FamilyTree.templates.john)
    FamilyTree.templates.john_female = Object.assign({}, FamilyTree.templates.john)
    FamilyTree.templates.john_male.plus =
        '<circle cx="0" cy="0" r="15" fill="#ffffff" stroke="#aeaeae" stroke-width="1"></circle>'
        + '<line x1="-11" y1="0" x2="11" y2="0" stroke-width="1" stroke="#aeaeae"></line>'
        + '<line x1="0" y1="-11" x2="0" y2="11" stroke-width="1" stroke="#aeaeae"></line>';
    FamilyTree.templates.john_male.minus =
        '<circle cx="0" cy="0" r="15" fill="#ffffff" stroke="#aeaeae" stroke-width="1"></circle>'
        + '<line x1="-11" y1="0" x2="11" y2="0" stroke-width="1" stroke="#aeaeae"></line>';
    FamilyTree.templates.john_female.plus =
        '<circle cx="0" cy="0" r="15" fill="#ffffff" stroke="#aeaeae" stroke-width="1"></circle>'
        + '<line x1="-11" y1="0" x2="11" y2="0" stroke-width="1" stroke="#aeaeae"></line>'
        + '<line x1="0" y1="-11" x2="0" y2="11" stroke-width="1" stroke="#aeaeae"></line>';
    FamilyTree.templates.john_female.minus =
        '<circle cx="0" cy="0" r="15" fill="#ffffff" stroke="#aeaeae" stroke-width="1"></circle>'
        + '<line x1="-11" y1="0" x2="11" y2="0" stroke-width="1" stroke="#aeaeae"></line>';

    FamilyTree.templates.john_female.defs =
        `<g transform="matrix(0.05,0,0,0.05,-12,-9)" id="heart">
        <path fill="#F57C00" d="M438.482,58.61c-24.7-26.549-59.311-41.655-95.573-41.711c-36.291,0.042-70.938,15.14-95.676,41.694l-8.431,8.909  l-8.431-8.909C181.284,5.762,98.663,2.728,45.832,51.815c-2.341,2.176-4.602,4.436-6.778,6.778 c-52.072,56.166-52.072,142.968,0,199.134l187.358,197.581c6.482,6.843,17.284,7.136,24.127,0.654 c0.224-0.212,0.442-0.43,0.654-0.654l187.29-197.581C490.551,201.567,490.551,114.77,438.482,58.61z"/>
    <g>
    <style>
        .{randId} .bft-edit-form-header, .{randId} .bft-img-button{
            background-color: #aeaeae;
        }
        .{randId}.male .bft-edit-form-header, .{randId}.male .bft-img-button{
            background-color: #039BE5;
        }        
        .{randId}.male div.bft-img-button:hover{
            background-color: #F57C00;
        }
        .{randId}.female .bft-edit-form-header, .{randId}.female .bft-img-button{
            background-color: #F57C00;
        }        
        .{randId}.female div.bft-img-button:hover{
            background-color: #039BE5;
        }
    </style>`;
    FamilyTree.templates.john_male.defs =
        `<g transform="matrix(0.05,0,0,0.05,-12,-9)" id="heart">
        <path fill="#F57C00" d="M438.482,58.61c-24.7-26.549-59.311-41.655-95.573-41.711c-36.291,0.042-70.938,15.14-95.676,41.694l-8.431,8.909  l-8.431-8.909C181.284,5.762,98.663,2.728,45.832,51.815c-2.341,2.176-4.602,4.436-6.778,6.778 c-52.072,56.166-52.072,142.968,0,199.134l187.358,197.581c6.482,6.843,17.284,7.136,24.127,0.654 c0.224-0.212,0.442-0.43,0.654-0.654l187.29-197.581C490.551,201.567,490.551,114.77,438.482,58.61z"/>
    <g>
    <style>
        .{randId} .bft-edit-form-header, .{randId} .bft-img-button{
            background-color: #aeaeae;
        }
        .{randId}.male .bft-edit-form-header, .{randId}.male .bft-img-button{
            background-color: #039BE5;
        }        
        .{randId}.male div.bft-img-button:hover{
            background-color: #F57C00;
        }
        .{randId}.female .bft-edit-form-header, .{randId}.female .bft-img-button{
            background-color: #F57C00;
        }        
        .{randId}.female div.bft-img-button:hover{
            background-color: #039BE5;
        }
    </style>`;
}
function iterate(c, n, collapseIds, id) {
    if (id != n.id) {
        console.log(n)
        collapseIds.push(n.id);
    }

    for (var i = 0; i < n.ftChildrenIds.length; i++) {
        iterate(c, c.getNode(n.ftChildrenIds[i]), collapseIds, id)
    }
}


// test
//JavaScript

// OrgChart.templates.john.defs = '<g transform="matrix(0.05,0,0,0.05,-12,-9)" id="heart"><path fill="#F57C00" d="M438.482,58.61c-24.7-26.549-59.311-41.655-95.573-41.711c-36.291,0.042-70.938,15.14-95.676,41.694l-8.431,8.909  l-8.431-8.909C181.284,5.762,98.663,2.728,45.832,51.815c-2.341,2.176-4.602,4.436-6.778,6.778 c-52.072,56.166-52.072,142.968,0,199.134l187.358,197.581c6.482,6.843,17.284,7.136,24.127,0.654 c0.224-0.212,0.442-0.43,0.654-0.654l187.29-197.581C490.551,201.567,490.551,114.77,438.482,58.61z"/><g>';


// var family = new OrgChart(document.getElementById("tree"), {
//     // mouseScrool: FamilyTree.none,
//     siblingSeparation: 120, //between 2 brothers
//     subtreeSeparation: 150, //between 2 family
//     template: 'john',
//     nodeBinding: {
//         field_0: "name",
//         field_1: "born",
//         field_2: "id",
//         id: "id",
//         father: "fid",
//         mother: "mid",
//         img_0: "img",
//     },
//     miniMap: true,
//     scaleInitial:OrgChart.match.boundary,
//     nodeMenu: {
//         edit: { text: 'Edit' },
//         details: { text: 'Details' },
//     },
//     menu: {
//         pdf: { text: "Export PDF" },
//         png: { text: "Export PNG" },
//         svg: { text: "Export SVG" },
//         csv: { text: "Export CSV" }
//     },
//     nodeTreeMenu: true
// });
//
// family.on('render-link', function (sender, args) {
//     if (args.cnode.ppid != undefined) {
//         args.html += '<use xlink:href="#heart" x="' + args.p.xa + '" y="' + args.p.ya + '"/>';
//     }
// });
//
//
// family.load(
//     [
//         { id: 168, pids: [167], gender: 'female', name: '168'},
//         { id: 167, pids: [168, 170], gender: 'male', name: '167'},
//         { id: 135, fid:167, mid:168, gender: 'male', name:'135'},
//         { id: 170, pid: [167], gender: 'female', name: '170'},
//         { id: 176, fid:167, mid:170, gender: 'male', name:'176'},
//         { id: 172, pid: 170, gender: 'female', name:'172', tags: ['partner']},
//         { id: 180, fid:170, ppid:172, gender: 'male', name:'180'}
//
//     ]
// );


