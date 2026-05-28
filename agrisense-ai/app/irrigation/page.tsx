"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion } from "framer-motion";
import {
  Droplets, Thermometer, Wind, Waves, Gauge, Power, Zap,
  Brain, ArrowRight, TrendingDown, AlertTriangle, CheckCircle2, Settings
} from "lucide-react";

function SensorCard({ label, value, unit, icon: Icon, color, bg, trend }: {
  label: string; value: number | string; unit: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; bg: string; trend?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(47,158,68,0.12)" }}
      className="rounded-[24px] p-5 flex flex-col gap-3 transition-shadow"
      style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 2px 16px rgba(47,158,68,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}>
            {trend}
          </span>
        )}
        <span className="pulse-dot" />
      </div>
      <div>
        <div className="text-3xl font-bold font-mono" style={{ color: "#1e2b22" }}>
          {value}<span className="text-lg font-normal ml-1" style={{ color: "#6b7c72" }}>{unit}</span>
        </div>
        <p className="text-xs mt-1" style={{ color: "#6b7c72" }}>{label}</p>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(217,229,220,0.5)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${typeof value === "number" ? Math.min(value, 100) : 70}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </motion.div>
  );
}

function PumpToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.96 }}
      className="relative w-16 h-8 rounded-full transition-colors duration-300 flex-shrink-0"
      style={{ background: active ? "#2f9e44" : "#d9e5dc" }}
    >
      <motion.div
        animate={{ x: active ? 32 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
      />
    </motion.button>
  );
}

export default function IrrigationPage() {
  useRealtimeData();
  const { sensorData, pumpActive, pumpAutoMode, moistureThreshold, togglePump, toggleAutoMode, setMoistureThreshold } = useAgriStore();

  const aiInsights = [
    {
      icon: Droplets, color: "#38bdf8",
      title: "Watering Recommendation",
      desc: "Soil moisture at optimal level. Next scheduled watering in 2h 15m.",
      confidence: 94, action: "Schedule",
    },
    {
      icon: Brain, color: "#a78bfa",
      title: "Disease Prevention",
      desc: "Maintain humidity below 80% to reduce Early Blight risk in Bed #08.",
      confidence: 87, action: "View Plan",
    },
    {
      icon: TrendingDown, color: "#f4c542",
      title: "Predicted Soil Dryness",
      desc: "Soil moisture will drop below 50% threshold in approx. 3 hours.",
      confidence: 79, action: "Set Alert",
    },
    {
      icon: Zap, color: "#22c55e",
      title: "Irrigation Efficiency",
      desc: "Current irrigation cycle is 94% efficient. Water usage optimized.",
      confidence: 96, action: "Details",
    },
  ];

  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>Irrigation Control</h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
          Automated pump control with AI-powered irrigation management
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-5 mb-5">
        {/* Pump Control Panel */}
        <div className="rounded-[28px] p-6 flex flex-col gap-5"
          style={{
            background: "linear-gradient(165deg,#1a3326,#0f2218)",
            border: "1px solid rgba(47,158,68,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Pump Control Panel</h3>
            <Settings className="w-4 h-4 text-green-400" />
          </div>

          {/* Main pump indicator */}
          <div className="flex flex-col items-center py-6 gap-4">
            <motion.div
              animate={{
                boxShadow: pumpActive
                  ? ["0 0 0 0 rgba(47,158,68,0.4)", "0 0 0 24px rgba(47,158,68,0)", "0 0 0 0 rgba(47,158,68,0.4)"]
                  : "0 0 0 0 rgba(47,158,68,0)",
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-28 h-28 rounded-full flex items-center justify-center relative cursor-pointer"
              onClick={togglePump}
              style={{
                background: pumpActive
                  ? "linear-gradient(135deg,#2f9e44,#1f6f3d)"
                  : "rgba(255,255,255,0.08)",
                border: `3px solid ${pumpActive ? "#22c55e" : "rgba(255,255,255,0.15)"}`,
              }}
            >
              <Power className="w-10 h-10" style={{ color: pumpActive ? "#fff" : "#4a6856" }} />
              {pumpActive && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-green-400"
                  animate={{ scale: [1, 1.3, 1.3], opacity: [0.6, 0, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
            <div className="text-center">
              <p className="font-bold text-lg" style={{ color: pumpActive ? "#4ade80" : "#4a6856" }}>
                {pumpActive ? "PUMP ACTIVE" : "PUMP OFFLINE"}
              </p>
              <p className="text-xs mt-0.5 text-green-600">
                {pumpActive ? "Water flowing at optimal rate" : "Click to activate pump"}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 px-4 rounded-[16px]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <p className="text-sm font-semibold text-white">Main Pump</p>
                <p className="text-xs text-green-600">Manual control</p>
              </div>
              <PumpToggle active={pumpActive} onToggle={togglePump} />
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-[16px]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <p className="text-sm font-semibold text-white">Auto Mode</p>
                <p className="text-xs text-green-600">AI-controlled irrigation</p>
              </div>
              <PumpToggle active={pumpAutoMode} onToggle={toggleAutoMode} />
            </div>

            <div className="py-3 px-4 rounded-[16px]"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">Moisture Threshold</p>
                  <p className="text-xs text-green-600">Trigger irrigation below</p>
                </div>
                <span className="text-lg font-bold font-mono" style={{ color: "#4ade80" }}>
                  {moistureThreshold}%
                </span>
              </div>
              <input
                type="range" min={20} max={80} value={moistureThreshold}
                onChange={(e) => setMoistureThreshold(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #2f9e44 ${((moistureThreshold - 20) / 60) * 100}%, rgba(255,255,255,0.15) ${((moistureThreshold - 20) / 60) * 100}%)`,
                  accentColor: "#2f9e44",
                }}
              />
              <div className="flex justify-between text-[10px] text-green-700 mt-1">
                <span>20%</span><span>80%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sensor Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <SensorCard label="Soil Moisture" value={sensorData.soilMoisture} unit="%" icon={Droplets} color="#38bdf8" bg="rgba(56,189,248,0.1)" trend="↑ Stable" />
          <SensorCard label="Water Flow" value={sensorData.waterFlow} unit="L/m" icon={Waves} color="#2f9e44" bg="rgba(47,158,68,0.1)" />
          <SensorCard label="Tank Capacity" value={sensorData.tankCapacity} unit="%" icon={Gauge} color="#a78bfa" bg="rgba(167,139,250,0.1)" />
          <SensorCard label="Temperature" value={sensorData.temperature} unit="°C" icon={Thermometer} color="#f4c542" bg="rgba(244,197,66,0.1)" />
          <SensorCard label="Humidity" value={sensorData.humidity} unit="%" icon={Wind} color="#34d399" bg="rgba(52,211,153,0.1)" />
          <SensorCard label="pH Level" value={sensorData.phLevel} unit="pH" icon={Zap} color="#f87171" bg="rgba(248,113,113,0.1)" />
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-[28px] p-6" style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5" style={{ color: "#2f9e44" }} />
          <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>AI Prediction Insights</h3>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold ml-auto"
            style={{ background: "rgba(47,158,68,0.1)", color: "#2f9e44" }}>
            Powered by AI
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {aiInsights.map(({ icon: Icon, color, title, desc, confidence, action }) => (
            <motion.div
              key={title}
              whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(47,158,68,0.1)" }}
              className="rounded-[20px] p-4 flex flex-col gap-3 transition-shadow"
              style={{ background: "rgba(238,243,239,0.6)", border: "1px solid rgba(217,229,220,0.5)" }}
            >
              <div className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                style={{ background: `${color}18` }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "#1e2b22" }}>{title}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "#6b7c72" }}>{desc}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                  <span className="text-[10px] font-semibold" style={{ color: "#22c55e" }}>
                    {confidence}% confident
                  </span>
                </div>
                <button className="flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: "#2f9e44" }}>
                  {action} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
