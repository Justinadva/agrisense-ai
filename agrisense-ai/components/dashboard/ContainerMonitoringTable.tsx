"use client";

import { useAgriStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Droplets, Thermometer, Heart, ChevronRight, ArrowUpRight } from "lucide-react";

function ProgressRing({ value, size = 52, stroke = 4, color = "#2f9e44" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(217,229,220,0.5)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        className="rotate-90 origin-center"
        style={{ fontSize: 11, fontWeight: 700, fill: color, transform: "rotate(90deg)", transformOrigin: "50% 50%" }}>
        {value}%
      </text>
    </svg>
  );
}

const statusStyles = {
  Optimal: { bg: "rgba(34,197,94,0.1)", color: "#16a34a", dot: "#22c55e" },
  Warning: { bg: "rgba(250,204,21,0.12)", color: "#ca8a04", dot: "#facc15" },
  Critical: { bg: "rgba(239,68,68,0.1)", color: "#dc2626", dot: "#ef4444" },
  Stable: { bg: "rgba(56,189,248,0.1)", color: "#0284c7", dot: "#38bdf8" },
};

export default function ContainerMonitoringTable() {
  const { containers } = useAgriStore();

  return (
    <div
      className="rounded-[28px] overflow-hidden"
      style={{
        background: "#f7faf8",
        border: "1px solid #d9e5dc",
        boxShadow: "0 4px 32px rgba(47,158,68,0.07)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#d9e5dc" }}>
        <div>
          <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>Container Monitoring</h3>
          <p className="text-xs mt-0.5" style={{ color: "#6b7c72" }}>
            {containers.length} containers · Tomato Plant Beds
          </p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl"
          style={{ color: "#2f9e44", background: "rgba(47,158,68,0.08)" }}>
          View All <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_80px] gap-4 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "#6b7c72", background: "rgba(238,243,239,0.5)" }}>
        <span>Container</span>
        <span>Health</span>
        <span>AI Status</span>
        <span className="hidden md:block">Temperature</span>
        <span>Status</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y" style={{ borderColor: "#d9e5dc" }}>
        {containers.map((c, i) => {
          const s = statusStyles[c.status];
          const ringColor = c.healthScore >= 80 ? "#22c55e" : c.healthScore >= 60 ? "#f4c542" : "#ef4444";

          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ backgroundColor: "rgba(238,243,239,0.8)" }}
              className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_80px] gap-4 items-center px-6 py-3 transition-colors"
            >
              {/* Name */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(47,158,68,0.1)" }}>
                  <span className="text-xs font-bold" style={{ color: "#2f9e44" }}>
                    #{c.name.split("#")[1]}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1e2b22" }}>{c.name}</p>
                  <p className="text-[10px]" style={{ color: "#6b7c72" }}>Last scan: {c.lastScan}</p>
                </div>
              </div>

              {/* Progress Ring */}
              <div className="flex items-center">
                <ProgressRing value={c.healthScore} size={48} color={ringColor} />
              </div>

              {/* AI Health */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#38bdf8" }} />
                  <span className="text-xs font-medium truncate" style={{ color: "#1e2b22" }}>{c.aiHealth}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-full max-w-[80px] h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(217,229,220,0.5)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.moisture}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: i * 0.05 }}
                      className="h-full rounded-full"
                      style={{
                        background: c.moisture > 60 ? "#22c55e" : c.moisture > 40 ? "#f4c542" : "#ef4444"
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "#6b7c72" }}>{c.moisture}%</span>
                </div>
              </div>

              {/* Temperature */}
              <div className="hidden md:flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5" style={{ color: "#f4c542" }} />
                <span className="text-sm font-mono font-medium" style={{ color: "#1e2b22" }}>{c.temperature}°C</span>
              </div>

              {/* Status */}
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: s.bg, color: s.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {c.status}
                </span>
              </div>

              {/* Details */}
              <div className="flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg,#2f9e44,#1f6f3d)" }}
                >
                  Details
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
