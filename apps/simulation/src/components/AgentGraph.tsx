"use client";
import { useRef, useEffect, useCallback, useState } from "react";
import { usePoll } from "@/hooks/usePoll";

interface GraphNode {
  id: number;
  name: string;
  profession: string;
  balance: string;
  // force sim state (mutable)
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: number;
  target: number;
  type: "agreement" | "transaction";
  amount: string;
}

interface GraphData {
  nodes: Omit<GraphNode, "x" | "y" | "vx" | "vy">[];
  edges: GraphEdge[];
}

// Color palette for 20 professions
const PROFESSION_COLORS: Record<string, string> = {
  developer: "#3b82f6", designer: "#8b5cf6", writer: "#ec4899", "data-analyst": "#06b6d4",
  "security-auditor": "#f59e0b", accountant: "#84cc16", chef: "#f97316", driver: "#6366f1",
  doctor: "#ef4444", lawyer: "#a855f7", teacher: "#14b8a6", mechanic: "#78716c",
  plumber: "#0ea5e9", electrician: "#eab308", photographer: "#d946ef", musician: "#22c55e",
  marketer: "#f43f5e", researcher: "#2dd4bf", architect: "#fb923c", therapist: "#a78bfa",
};

interface Props {
  selectedAgentId: number | null;
  onSelectAgent: (id: number | null) => void;
}

export function AgentGraph({ selectedAgentId, onSelectAgent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const { data: graphData } = usePoll<GraphData>("/api/simulation/graph", 2000);

  // Update nodes/edges when data changes
  useEffect(() => {
    if (!graphData) return;

    const existingMap = new Map(nodesRef.current.map(n => [n.id, n]));
    const canvas = canvasRef.current;
    const w = canvas?.width || 800;
    const h = canvas?.height || 600;

    nodesRef.current = graphData.nodes.map(n => {
      const existing = existingMap.get(n.id);
      return {
        ...n,
        x: existing?.x ?? w / 2 + (Math.random() - 0.5) * w * 0.8,
        y: existing?.y ?? h / 2 + (Math.random() - 0.5) * h * 0.8,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      };
    });

    edgesRef.current = graphData.edges;
  }, [graphData]);

  // Force simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width * window.devicePixelRatio;
        canvas.height = entry.contentRect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    });
    resizeObserver.observe(canvas);

    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      if (nodes.length === 0) {
        animRef.current = requestAnimationFrame(simulate);
        return;
      }

      // Forces
      const REPULSION = 500;
      const ATTRACTION = 0.005;
      const CENTER_GRAVITY = 0.01;
      const DAMPING = 0.9;

      // Repulsion (n^2 -- fine for 100 nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx += fx;
          nodes[i].vy += fy;
          nodes[j].vx -= fx;
          nodes[j].vy -= fy;
        }
      }

      // Attraction along edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const force = ATTRACTION;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }

      // Center gravity + damping + position update
      for (const node of nodes) {
        node.vx += (w / 2 - node.x) * CENTER_GRAVITY;
        node.vy += (h / 2 - node.y) * CENTER_GRAVITY;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;
        // Bounds
        node.x = Math.max(20, Math.min(w - 20, node.x));
        node.y = Math.max(20, Math.min(h - 20, node.y));
      }

      // Render
      ctx.clearRect(0, 0, w, h);

      // Edges
      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;

        const isHighlighted = selectedAgentId !== null &&
          (edge.source === selectedAgentId || edge.target === selectedAgentId);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isHighlighted
          ? (edge.type === "agreement" ? "#22c55e" : "#f59e0b")
          : "rgba(100, 100, 100, 0.15)";
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
        ctx.stroke();
      }

      // Nodes
      for (const node of nodes) {
        const bal = parseFloat(node.balance);
        const radius = Math.max(3, Math.sqrt(bal) * 0.15);
        const isSelected = node.id === selectedAgentId;
        const isHovered = node.id === hoveredNode?.id;
        const color = PROFESSION_COLORS[node.profession] || "#888";

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected || isHovered ? color : color + "AA";
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label for selected/hovered
        if (isSelected || isHovered) {
          ctx.fillStyle = "#e4e4e7";
          ctx.font = "10px monospace";
          ctx.fillText(`${node.name} ($${parseFloat(node.balance).toFixed(0)})`, node.x + radius + 4, node.y + 3);
        }
      }

      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
    };
  }, [selectedAgentId, hoveredNode]);

  // Mouse interaction
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = nodesRef.current.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      const radius = Math.max(3, Math.sqrt(parseFloat(n.balance)) * 0.15);
      return dx * dx + dy * dy < (radius + 5) * (radius + 5);
    });

    onSelectAgent(clicked ? (selectedAgentId === clicked.id ? null : clicked.id) : null);
  }, [selectedAgentId, onSelectAgent]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hovered = nodesRef.current.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      const radius = Math.max(3, Math.sqrt(parseFloat(n.balance)) * 0.15);
      return dx * dx + dy * dy < (radius + 5) * (radius + 5);
    });

    setHoveredNode(hovered || null);
  }, []);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-dim)]">
        AGENT NETWORK
        {selectedAgentId !== null && (
          <span className="ml-2 text-[var(--color-amber)]">
            selected: Agent-{String(selectedAgentId + 1).padStart(3, "0")}
          </span>
        )}
      </div>
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          className="absolute inset-0 w-full h-full cursor-crosshair"
        />
      </div>
    </div>
  );
}
