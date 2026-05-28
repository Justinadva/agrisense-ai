"use client";

import { motion } from "framer-motion";
import { Cloud, Sun, Droplets, Wind } from "lucide-react";

export default function WeatherWidget() {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-[18px]"
      style={{
        background: "rgba(247,250,248,0.8)",
        border: "1px solid #d9e5dc",
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 12px rgba(47,158,68,0.06)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Sun className="w-5 h-5" style={{ color: "#f4c542" }} />
        <span className="text-lg font-bold font-mono" style={{ color: "#1e2b22" }}>28°C</span>
      </div>
      <div className="h-8 w-px" style={{ background: "#d9e5dc" }} />
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-xs" style={{ color: "#6b7c72" }}>
          <Droplets className="w-3 h-3" style={{ color: "#38bdf8" }} />
          <span>72% humidity</span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "#6b7c72" }}>
          <Wind className="w-3 h-3" style={{ color: "#94a3b8" }} />
          <span>12 km/h</span>
        </div>
      </div>
      <div className="text-xs font-medium px-2 py-1 rounded-lg"
        style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
        Clear
      </div>
    </motion.div>
  );
}
