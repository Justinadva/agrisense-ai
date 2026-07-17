"use client";

import { useAgriStore } from "@/lib/store";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, ArrowUpRight } from "lucide-react";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }>; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-[14px] px-3 py-2 text-xs"
        style={{ background: "#1a3326", border: "1px solid rgba(47,158,68,0.3)", color: "#e8f0eb" }}>
        <p className="font-semibold mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function GrowthAnalyticsCard() {
  const { chartHistory } = useAgriStore();
  const recent = chartHistory.slice(-18);
  const hasData = recent.length > 0;
  const avgHealth = hasData
    ? Math.round(recent.reduce((a, b) => a + b.healthScore, 0) / recent.length)
    : 0;
  const trend = recent.length > 1
    ? (recent[recent.length - 1].healthScore - recent[0].healthScore).toFixed(1)
    : "0";
  const isPositive = parseFloat(trend) >= 0;

  return (
    <div
      className="rounded-[28px] p-6 flex flex-col"
      style={{
        background: "linear-gradient(165deg, #1a3326 0%, #0f2218 100%)",
        border: "1px solid rgba(47,158,68,0.2)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.15)",
        minHeight: 300,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-base text-white">Growth Analytics</h3>
          <p className="text-green-300 text-xs mt-0.5">Plant Health & Moisture Trends</p>
        </div>
        <button className="text-xs font-medium px-3 py-1.5 rounded-xl"
          style={{ color: "#4ade80", background: "rgba(74,222,128,0.1)" }}>
          Details
        </button>
      </div>

      {/* Floating badge */}
      <div className="flex items-center gap-4 mb-4">
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          {isPositive ? "+" : ""}{trend} Health Score
        </motion.div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "#6b7c72" }}>
          Avg: <span style={{ color: "#4ade80" }} className="font-semibold ml-1">{avgHealth}%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={recent} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="healthLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2f9e44" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#4a6856" }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#4a6856" }}
              axisLine={false}
              tickLine={false}
              domain={[40, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={80} stroke="rgba(47,158,68,0.2)" strokeDasharray="4 4" />
            <Line
              type="monotoneX"
              dataKey="healthScore"
              name="Health"
              stroke="url(#healthLine)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }}
            />
            <Line
              type="monotoneX"
              dataKey="moisture"
              name="Moisture"
              stroke="#f4c542"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              activeDot={{ r: 4, fill: "#f4c542" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t" style={{ borderColor: "rgba(47,158,68,0.15)" }}>
        {[
          { label: "0 days", value: "Start" },
          { label: "42 days", value: "Mid Cycle" },
          { label: "70 days", value: "Harvest" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-[10px]" style={{ color: "#4a6856" }}>{s.label}</p>
            <p className="text-xs font-semibold mt-0.5 text-green-300">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
