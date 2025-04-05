import * as d3 from "d3";
// import { sankeyJustify, sankeyLinkHorizontal } from "d3-sankey";
import * as bihisankey from './BiHiSankey/bihisankey.js';

const MARGIN_Y = 25;
const MARGIN_X = 5;
const COLORS = ["#e0ac2b", "#e85252", "#6689c6", "#9a6fb0", "#a53253"];

const OPACITY = {
        NODE_DEFAULT: 0.9,
        NODE_FADED: 0.1,
        NODE_HIGHLIGHT: 0.8,
        LINK_DEFAULT: 0.6,
        LINK_FADED: 0.05,
        LINK_HIGHLIGHT: 0.9
    };
const TYPES = ["M", "couple", "F","highlighted"];
const TYPE_COLORS = ["#77B5FE", "#d95f02", "#FD3F92","#3366FF"];
const TYPE_HIGHLIGHT_COLORS = ["#66c2a5", "#fc8d62", "#8da0cb","#4050A0"];
const LINK_COLOR = "#b3b3b3";
const INFLOW_COLOR = "#2E86D1";
const OUTFLOW_COLOR = "#D63028";
const NODE_WIDTH = 20;
const COLLAPSER = {
        RADIUS: NODE_WIDTH / 2,
        SPACING: 1
    };
const OUTER_MARGIN = 65;
const MARGIN = {
        TOP: 2.5,
        RIGHT: 2.5,
        BOTTOM: 2.5,
        LEFT: 2.5

    };
 const TRANSITION_DURATION = 400;
 const HEIGHT = 900 - MARGIN.TOP - MARGIN.BOTTOM;
 const WIDTH =  600 - MARGIN.LEFT - MARGIN.RIGHT;
 const LAYOUT_INTERATIONS = 0;
 const REFRESH_INTERVAL = 3500;

type Data = {
    nodes: { name: string; category: string }[];
    links: { source: string; target: string; value: number }[];
};

type SankeyProps = {
    width: number;
    height: number;
    data: Data;
};

export const Sankey = ({ width, height, data }: SankeyProps) => {
    const allGroups = [...new Set(data.nodes.map((d) => d.category))].sort();
    const colorScale = d3.scaleOrdinal<string>().domain(allGroups).range(COLORS);

    // Set the sankey diagram properties
    const sankeyGenerator = bihisankey.biHiSankey() // TODO: find how to type the sankey() function
        .nodeWidth(26)
        .nodePadding(10)
        .extent([
            [MARGIN_X, MARGIN_Y],
            [width - MARGIN_X, height - MARGIN_Y],
        ])
        .nodeId((node) => node.name) // Accessor function: how to retrieve the id that defines each node. This id is then used for the source and target props of links
        .nodeAlign(sankeyJustify); // Algorithm used to decide node position

    // Compute nodes and links positions
    const { nodes, links } = sankeyGenerator(data);

    //
    // Draw the nodes
    //
    const allNodes = nodes.map((node) => {
        return (
            <g key={node.index}>
                <rect
                    height={node.y1 - node.y0}
                    width={sankeyGenerator.nodeWidth()}
                    x={node.x0}
                    y={node.y0}
                    stroke={"black"}
                    fill={colorScale(node.category)}
                    fillOpacity={1}
                    rx={0.9}
                />
            </g>
        );
    });

    //
    // Draw the links
    //
    const allLinks = links.map((link, i) => {
        const linkGenerator = sankeyLinkHorizontal();
        const path = linkGenerator(link);

        return (
            <path
                key={i}
                d={path}
                stroke={colorScale(link.source.category)}
                fill="none"
                strokeOpacity={0.3}
                strokeWidth={link.width}
            />
        );
    });

    //
    // Draw the Labels
    //
    const allLabels = nodes.map((node, i) => {
        return (
            <text
                key={i}
                x={node.x0 < width / 2 ? node.x1 + 6 : node.x0 - 6}
                y={(node.y1 + node.y0) / 2}
                dy="0.35rem"
                textAnchor={node.x0 < width / 2 ? "start" : "end"}
                fontSize={12}
            >
                {node.name}
            </text>
        );
    });

    return (
        <div>
            <svg width={width} height={height}>
                {allLinks}
                {allNodes}
                {allLabels}
            </svg>
        </div>
    );
};
