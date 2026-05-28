"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { TrendingUp, BarChart3, Activity, Droplets, Thermometer, Brain } from "lucide-react";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-[14px] px-3 py-2 text-xs shadow-xl"
        style={{ background: "#1a3326", border: "1px solid rgba(47,158,68,0.3)", color: "#e8f0eb" }}>
        <p className="font-semibold mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name.includes("Temp") ? "°C" : "%"}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  useRealtimeData();
  const { chartHistory } = useAgriStore();
  const all = chartHistory;
  const recent = all.slice(-24);

  const avgMoisture = Math.round(recent.reduce((a, b) => a + b.moisture, 0) / (recent.length || 1));
  const avgTemp = Math.round(recent.reduce((a, b) => a + b.temperature, 0) / (recent.length || 1));
  const avgHealth = Math.round(recent.reduce((a, b) => a + b.healthScore, 0) / (recent.length || 1));
  const avgConf = Math.round(recent.reduce((a, b) => a + b.confidence, 0) / (recent.length || 1));

  const statCards = [
    { label: "Avg Soil Moisture", value: avgMoisture, unit: "%", icon: Droplets, color: "#38bdf8", change: "+2.1%" },
    { label: "Avg Temperature", value: avgTemp, unit: "°C", icon: Thermometer, color: "#f4c542", change: "-0.3°C" },
    { label: "Plant Health Score", value: avgHealth, unit: "%", icon: TrendingUp, color: "#22c55e", change: "+4.3%" },
    { label: "AI Confidence", value: avgConf, unit: "%", icon: Brain, color: "#a78bfa", change: "+1.2%" },
  ];

  // Hourly aggregation for bar chart
  const hourlyData = Array.from({ length: 12 }, (_, i) => {
    const slice = all.slice(i * 2, i * 2 + 2);
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / (arr.length || 1));
    return {
      hour: slice[0]?.time || `${(i + 8).toString().padStart(2, "0")}:00`,
      moisture: avg(slice.map(s => s.moisture)),
      pump: avg(slice.map(s => s.pump)),
      health: avg(slice.map(s => s.healthScore)),
    };
  });

  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>Analytics</h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
          Comprehensive farm performance metrics and trends
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {statCards.map(({ label, value, unit, icon: Icon, color, change }) => {
          const isPos = change.startsWith("+");
          return (
            <motion.div
              key={label}
              whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(47,158,68,0.1)" }}
              className="rounded-[24px] p-5 transition-shadow"
              style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 2px 16px rgba(47,158,68,0.06)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-[14px] flex items-center justify-center"
                  style={{ background: `${color}18` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{
                    background: isPos ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    color: isPos ? "#16a34a" : "#dc2626",
                  }}>
                  {change}
                </span>
              </div>
              <div className="text-3xl font-bold font-mono" style={{ color: "#1e2b22" }}>
                {value}<span className="text-base font-normal ml-1" style={{ color: "#6b7c72" }}>{unit}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: "#6b7c72" }}>{label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 mb-5">
        {/* Multi-line Area Chart */}
        <div className="rounded-[28px] p-6"
          style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 4px 32px rgba(47,158,68,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>Moisture & Temperature Trend</h3>
              <p className="text-xs mt-0.5" style={{ color: "#6b7c72" }}>Last 24 data points</p>
            </div>
            <Activity className="w-4 h-4" style={{ color: "#2f9e44" }} />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recent} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f4c542" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f4c542" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(217,229,220,0.4)" strokeDasharray="4 4" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#6b7c72" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7c72" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#6b7c72" }} />
                <Area type="monotone" dataKey="moisture" name="Moisture %" stroke="#38bdf8" strokeWidth={2} fill="url(#mGrad)" dot={false} />
                <Area type="monotone" dataKey="temperature" name="Temp" stroke="#f4c542" strokeWidth={2} fill="url(#tGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Health Score Line */}
        <div className="rounded-[28px] p-6"
          style={{ background: "linear-gradient(165deg,#1a3326,#0f2218)", border: "1px solid rgba(47,158,68,0.2)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-white">Plant Health Score</h3>
              <p className="text-xs mt-0.5 text-green-600">AI-calculated wellness</p>
            </div>
            <Brain className="w-4 h-4 text-green-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recent} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2f9e44" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(47,158,68,0.1)" strokeDasharray="4 4" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#4a6856" }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "#4a6856" }} axisLine={false} tickLine={false} domain={[40, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="healthScore" name="Health %" stroke="#22c55e" strokeWidth={2.5} dot={false}
                  activeDot={{ r: 5, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="confidence" name="AI Conf %" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="rounded-[28px] p-6"
        style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 4px 32px rgba(47,158,68,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>Pump Activity vs Moisture</h3>
            <p className="text-xs mt-0.5" style={{ color: "#6b7c72" }}>Irrigation correlation analysis</p>
          </div>
          <BarChart3 className="w-4 h-4" style={{ color: "#2f9e44" }} />
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="rgba(217,229,220,0.4)" strokeDasharray="4 4" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#6b7c72" }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7c72" }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#6b7c72" }} />
              <Bar dataKey="moisture" name="Moisture %" fill="#38bdf8" radius={[6, 6, 0, 0]} fillOpacity={0.8} />
              <Bar dataKey="pump" name="Pump %" fill="#2f9e44" radius={[6, 6, 0, 0]} fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
