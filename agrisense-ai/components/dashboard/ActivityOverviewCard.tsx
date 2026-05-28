"use client";

import { useAgriStore } from "@/lib/store";
import { motion } from "framer-motion";
import { scheduledTasks } from "@/lib/mockData";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Clock, CheckCircle2, Play, Calendar } from "lucide-react";

const statusConfig = {
  Scheduled: { color: "#6b7c72", bg: "rgba(107,124,114,0.1)", icon: Calendar },
  Running: { color: "#2f9e44", bg: "rgba(47,158,68,0.12)", icon: Play },
  Completed: { color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: CheckCircle2 },
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-[14px] px-3 py-2 text-xs"
        style={{ background: "#1a3326", border: "1px solid rgba(47,158,68,0.3)", color: "#e8f0eb" }}>
        <p className="font-semibold mb-1">{label}</p>
        <p style={{ color: "#4ade80" }}>Moisture: {payload[0]?.value}%</p>
        {payload[1] && <p style={{ color: "#f4c542" }}>Pump: {payload[1]?.value}%</p>}
      </div>
    );
  }
  return null;
};

export default function ActivityOverviewCard() {
  const { chartHistory } = useAgriStore();
  const recentPoints = chartHistory.slice(-12);

  return (
    <div className="rounded-[28px] p-5 flex flex-col gap-4"
      style={{
        background: "#f7faf8",
        border: "1px solid #d9e5dc",
        boxShadow: "0 4px 32px rgba(47,158,68,0.07)",
      }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>Activity Overview</h3>
        <button className="text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
          style={{ color: "#2f9e44", background: "rgba(47,158,68,0.08)" }}>
          Details
        </button>
      </div>

      {/* Day selector */}
      <div className="flex items-center gap-1">
        {days.map((day, i) => (
          <button
            key={day}
            className="flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200"
            style={{
              background: i === todayIdx ? "#1e2b22" : "transparent",
              color: i === todayIdx ? "#ffffff" : "#6b7c72",
            }}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={recentPoints} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="moistGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2f9e44" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2f9e44" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pumpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f4c542" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f4c542" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#6b7c72" }} axisLine={false} tickLine={false} interval={3} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7c72" }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="moisture" stroke="#2f9e44" strokeWidth={2} fill="url(#moistGrad)" dot={false} />
            <Area type="monotone" dataKey="pump" stroke="#f4c542" strokeWidth={2} fill="url(#pumpGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 -mt-1">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7c72" }}>
          <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: "#2f9e44" }} />
          Moisture
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7c72" }}>
          <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: "#f4c542" }} />
          Pump Activity
        </div>
      </div>

      {/* Divider */}
      <div className="h-px" style={{ background: "#d9e5dc" }} />

      {/* Scheduled Tasks */}
      <div className="space-y-2">
        {scheduledTasks.slice(0, 3).map((task) => {
          const { color, bg, icon: Icon } = statusConfig[task.status];
          return (
            <motion.div
              key={task.id}
              whileHover={{ x: 2 }}
              className="flex items-center justify-between py-2 px-3 rounded-[16px]"
              style={{ background: "rgba(238,243,239,0.6)" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#1e2b22" }}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" style={{ color: "#6b7c72" }} />
                    <span className="text-[10px]" style={{ color: "#6b7c72" }}>{task.time}</span>
                  </div>
                </div>
              </div>
              <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ color, background: bg }}>
                {task.status}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
