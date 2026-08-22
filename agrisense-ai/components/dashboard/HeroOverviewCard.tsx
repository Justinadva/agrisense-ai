"use client";

import { useAgriStore } from "@/lib/store";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { Droplets, Thermometer, Wind, Brain, Leaf, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    const unsub = mv.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v) + suffix;
    });
    return () => { controls.stop(); unsub(); };
  }, [value, suffix, mv]);

  return <span ref={ref}>0{suffix}</span>;
}

const metrics = [
  { key: "soilMoisture", label: "Soil Moisture", icon: Droplets, suffix: "%", color: "#2f9e44", bg: "rgba(47,158,68,0.12)" },
  { key: "temperature", label: "Temperature", icon: Thermometer, suffix: "°C", color: "#f4c542", bg: "rgba(244,197,66,0.12)" },
  { key: "humidity", label: "Humidity", icon: Wind, suffix: "%", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  { key: "aiConfidence", label: "AI Confidence", icon: Brain, suffix: "%", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
];

export default function HeroOverviewCard() {
  const { sensorData } = useAgriStore();

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-6 flex flex-col justify-between min-h-[320px]"
      style={{
        background: "linear-gradient(135deg, #2f9e44 0%, #1a5e32 60%, #0f3d22 100%)",
        boxShadow: "0 12px 48px rgba(47,158,68,0.35)",
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15) 0%, transparent 40%)`,
        }}
      />

      {/* Top row */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="pulse-dot" />
            <span className="text-green-200 text-xs font-medium">Serial Monitoring</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight">Overview</h2>
          <p className="text-green-200 text-sm mt-1">Arduino Uno — via USB Serial Gateway</p>
        </div>

        {/* Plant illustration */}
        <div className="relative flex-shrink-0 w-44 h-44">
          {/* Floating labels */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-2 left-0 z-20"
          >
            <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              Healthy
            </span>
          </motion.div>
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-12 right-0 z-20"
          >
            <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30">
              <Droplets className="w-3 h-3 text-blue-300" />
              Moisture Stable
            </span>
          </motion.div>
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-4 left-0 z-20"
          >
            <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30">
              <Brain className="w-3 h-3 text-purple-300" />
              AI Monitoring
            </span>
          </motion.div>

          {/* Stylized plant */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 120 140" className="w-28 h-28 opacity-90" fill="none">
              {/* Pot */}
              <rect x="40" y="105" width="40" height="28" rx="6" fill="rgba(255,255,255,0.15)" />
              <rect x="35" y="100" width="50" height="8" rx="4" fill="rgba(255,255,255,0.2)" />
              {/* Stem */}
              <path d="M60 100 Q58 80 55 60 Q52 40 60 20" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeLinecap="round" />
              {/* Leaves */}
              <ellipse cx="60" cy="75" rx="22" ry="11" fill="rgba(255,255,255,0.25)" transform="rotate(-30 60 75)" />
              <ellipse cx="60" cy="60" rx="20" ry="10" fill="rgba(255,255,255,0.25)" transform="rotate(25 60 60)" />
              <ellipse cx="60" cy="45" rx="18" ry="9" fill="rgba(255,255,255,0.3)" transform="rotate(-20 60 45)" />
              {/* Tomatoes */}
              <circle cx="52" cy="70" r="6" fill="rgba(239,68,68,0.7)" />
              <circle cx="68" cy="65" r="5" fill="rgba(239,68,68,0.6)" />
              <circle cx="55" cy="55" r="4" fill="rgba(251,146,60,0.6)" />
              {/* Highlights */}
              <circle cx="50" cy="68" r="2" fill="rgba(255,255,255,0.4)" />
              <circle cx="66" cy="63" r="1.5" fill="rgba(255,255,255,0.4)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {metrics.map(({ key, label, icon: Icon, suffix, color, bg }) => (
          <motion.div
            key={key}
            whileHover={{ scale: 1.04 }}
            className="rounded-[18px] p-3"
            style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-green-100 text-[11px] font-medium leading-tight">{label}</span>
            </div>
            <div className="text-white text-2xl font-bold font-mono leading-none">
              <AnimatedNumber
                value={sensorData[key as keyof typeof sensorData] as number}
                suffix={suffix}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
