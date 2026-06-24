"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Activity, Droplets, Thermometer, Wind, Wifi, Camera,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Brain
} from "lucide-react";

function MiniCard({ label, value, unit, icon: Icon, color, bg }: {
  label: string; value: number | string; unit: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; bg: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-[20px] p-4 flex flex-col gap-2"
      style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="pulse-dot" />
      </div>
      <div>
        <div className="text-2xl font-bold font-mono" style={{ color: "#1e2b22" }}>
          {value}<span className="text-sm ml-0.5" style={{ color: "#6b7c72" }}>{unit}</span>
        </div>
        <p className="text-[11px]" style={{ color: "#6b7c72" }}>{label}</p>
      </div>
    </motion.div>
  );
}

export default function RealtimePage() {
  useRealtimeData();
  const { sensorData, chartHistory, alerts } = useAgriStore();
  const recent = chartHistory.slice(-16);

  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto pt-4">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>Realtime Monitoring</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
            Live sensor data — updates every 3 seconds
          </p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-[14px]"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <Wifi className="w-4 h-4" style={{ color: "#22c55e" }} />
          <span className="text-sm font-semibold" style={{ color: "#16a34a" }}>Connected — MQTT Live</span>
          <span className="pulse-dot" />
        </div>
      </div>

      {/* Sensor Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
        <MiniCard label="Soil Moisture" value={sensorData.soilMoisture} unit="%" icon={Droplets} color="#38bdf8" bg="rgba(56,189,248,0.1)" />
        <MiniCard label="Temperature" value={sensorData.temperature} unit="°C" icon={Thermometer} color="#f4c542" bg="rgba(244,197,66,0.1)" />
        <MiniCard label="Humidity" value={sensorData.humidity} unit="%" icon={Wind} color="#34d399" bg="rgba(52,211,153,0.1)" />
        <MiniCard label="AI Confidence" value={sensorData.aiConfidence} unit="%" icon={Brain} color="#a78bfa" bg="rgba(167,139,250,0.1)" />
        <MiniCard label="Water Flow" value={sensorData.waterFlow} unit="L/m" icon={Activity} color="#2f9e44" bg="rgba(47,158,68,0.1)" />
        <MiniCard label="pH Level" value={sensorData.phLevel} unit="" icon={TrendingUp} color="#f87171" bg="rgba(248,113,113,0.1)" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {[
          { key: "moisture" as const, label: "Soil Moisture %", color: "#38bdf8", gradId: "rt-m" },
          { key: "temperature" as const, label: "Temperature °C", color: "#f4c542", gradId: "rt-t" },
          { key: "confidence" as const, label: "AI Confidence %", color: "#a78bfa", gradId: "rt-c" },
        ].map(({ key, label, color, gradId }) => (
          <div key={key} className="rounded-[24px] p-5"
            style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 2px 16px rgba(47,158,68,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "#1e2b22" }}>{label}</h3>
              <span className="text-lg font-bold font-mono" style={{ color }}>
                {recent[recent.length - 1]?.[key] || 0}
              </span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={recent} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9bb8a4" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1a3326", border: "1px solid rgba(47,158,68,0.3)", borderRadius: 12, fontSize: 11, color: "#e8f0eb" }}
                    labelStyle={{ color: "#4ade80" }}
                  />
                  <Area type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* AI Status + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Status */}
        <div className="rounded-[28px] p-6"
          style={{ background: "linear-gradient(135deg,#1a3326,#0f2218)", border: "1px solid rgba(47,158,68,0.2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.15)" }}>
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">AI System Status</h3>
              <p className="text-xs text-green-600">Computer Vision Engine</p>
            </div>
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span className="pulse-dot" />
              <span className="text-xs font-semibold text-green-400">Healthy</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Disease Detection", value: `${sensorData.aiConfidence}%`, color: "#a78bfa" },
              { label: "Current Status", value: sensorData.disease, color: sensorData.disease === "Healthy" ? "#22c55e" : "#ef4444" },
              { label: "Camera Status", value: "3/3 Online", color: "#22c55e" },
              { label: "Model Version", value: "v3.2.1", color: "#4ade80" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-[16px] p-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] text-green-600 mb-1">{label}</p>
                <p className="text-sm font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-[28px] p-6"
          style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>Recent Activity</h3>
            <Camera className="w-4 h-4" style={{ color: "#2f9e44" }} />
          </div>
          <div className="space-y-2.5">
            {alerts.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-[16px]"
                style={{ background: "rgba(238,243,239,0.6)" }}>
                {a.type === "error" ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }} />
                  : a.type === "warning" ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#f4c542" }} />
                  : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#22c55e" }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#1e2b22" }}>{a.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#6b7c72" }}>{a.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" style={{ color: "#9bb8a4" }} />
                  <span className="text-[10px]" style={{ color: "#9bb8a4" }} suppressHydrationWarning>
                    {Math.floor((Date.now() - a.timestamp.getTime()) / 60000)}m ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
