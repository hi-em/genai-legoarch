import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  useReactFlow,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvas, useBuild, canEnter, progressOf } from "../state/store.js";
import { ZONES } from "./zones.js";
import ZoneNode from "./ZoneNode.jsx";
import OverviewHUD from "./OverviewHUD.jsx";

const LAYOUT_KEY = "lEgoarCh.layout.v1";
const nodeTypes = { zone: ZoneNode };

function loadLayout() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}; } catch { return {}; }
}
function saveLayout(nodes) {
  const map = {};
  for (const n of nodes) {
    const w = n.style?.width ?? n.width;
    const h = n.style?.height ?? n.height;
    map[n.id] = { x: n.position.x, y: n.position.y, w, h };
  }
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(map)); } catch {}
}

function buildInitialNodes() {
  const saved = loadLayout();
  return ZONES.map((z) => {
    const s = saved[z.id] || {};
    return {
      id: z.id,
      type: "zone",
      position: { x: s.x ?? z.x, y: s.y ?? z.y },
      style: { width: s.w ?? z.w, height: s.h ?? z.h },
      dragHandle: ".zone-drag",
      data: {},
    };
  });
}

function Flow() {
  const rf = useReactFlow();
  const registerApi = useCanvas((s) => s.registerApi);
  const setFocused = useCanvas((s) => s.setFocused);
  const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes());

  // build pipeline edges, recoloured as the build advances
  const brickModel = useBuild((s) => s.brickModel);
  const glbUrl = useBuild((s) => s.glbUrl);
  const edges = useMemo(() => {
    const mk = (source, target) => {
      const locked = progressOf(target) === "locked";
      return {
        id: `${source}-${target}`,
        source,
        target,
        animated: !locked,
        style: {
          stroke: locked ? "var(--border-dark)" : "var(--brand-blue)",
          strokeWidth: 3,
          strokeDasharray: locked ? "8 8" : undefined,
        },
      };
    };
    return [mk("generate", "viewer"), mk("viewer", "studio"), mk("studio", "shelf")];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brickModel, glbUrl]);

  useEffect(() => { registerApi(rf); }, [rf, registerApi]);

  // debounced layout persistence (positions + sizes)
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => saveLayout(nodes), 500);
    return () => clearTimeout(t.current);
  }, [nodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      onSelectionChange={({ nodes: sel }) => setFocused(sel[0]?.id ?? null)}
      proOptions={{ hideAttribution: true }}
      minZoom={0.08}
      maxZoom={1.6}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      selectNodesOnDrag={false}
      nodesConnectable={false}
      elevateNodesOnSelect
      panOnScroll={false}
      zoomOnDoubleClick={false}
      style={{ background: "transparent" }}
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="rgba(233,235,230,0.10)" />
      <Controls position="top-left" className="!left-4 !top-[84px] !shadow-pop" showInteractive={false} />
      <MiniMap
        position="bottom-left"
        pannable
        zoomable
        className="!bg-table-deep !rounded-lg !border !border-border-dark !shadow-pop"
        maskColor="rgba(0,0,0,0.55)"
        nodeColor={(n) => (canEnter(n.id) ? "#c4c8cb" : "#565a56")}
        nodeStrokeColor="transparent"
      />
    </ReactFlow>
  );
}

export default function World() {
  return (
    <div className="fixed inset-0 overflow-hidden felt">
      <ReactFlowProvider>
        <Flow />
        <OverviewHUD />
      </ReactFlowProvider>
    </div>
  );
}
