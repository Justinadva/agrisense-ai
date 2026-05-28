"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  Search, Filter, Download, Trash2, Clock, CheckCircle2,
  AlertTriangle, XCircle, Info, ChevronDown
} from "lucide-react";

const statusConfig = {
  success: { icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Success" },
  warning: { icon: AlertTriangle, color: "#f4c542", bg: "rgba(244,197,66,0.1)", label: "Warning" },
  error: { icon: XCircle, color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Error" },
  info: { icon: Info, color: "#38bdf8", bg: "rgba(56,189,248,0.1)", label: "Info" },
};

type Status = "all" | "success" | "warning" | "error" | "info";

export default function LogsPage() {
  useRealtimeData();
  const { logs, clearLogs } = useAgriStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status>("all");
  const [showFilter, setShowFilter] = useState(false);

  const filtered = useMemo(() =>
    logs.filter((l) => {
      const matchSearch =
        l.event.toLowerCase().includes(search.toLowerCase()) ||
        l.sensor.toLowerCase().includes(search.toLowerCase()) ||
        (l.aiResult || "").toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || l.status === filter;
      return matchSearch && matchFilter;
    }), [logs, search, filter]
  );

  const exportCSV = () => {
    const headers = ["Time", "Sensor", "Event", "Status", "AI Result"];
    const rows = filtered.map((l) => [l.time, l.sensor, l.event, l.status, l.aiResult || ""].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `agrisense-logs-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const c = { success: 0, warning: 0, error: 0, info: 0 };
    logs.forEach(l => c[l.status]++);
    return c;
  }, [logs]);

  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>Activity Logs</h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
          Realtime system events, sensor readings, and AI detection history
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3 mb-5">
        {(Object.entries(counts) as [Status, number][]).map(([status, count]) => {
          const { icon: Icon, color, bg, label } = statusConfig[status as keyof typeof statusConfig];
          return (
            <button
              key={status}
              onClick={() => setFilter(filter === status ? "all" : status)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-[14px] text-sm font-semibold transition-all"
              style={{
                background: filter === status ? color + "20" : bg,
                border: `1px solid ${filter === status ? color : "transparent"}`,
                color,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}: {count}
            </button>
          );
        })}
        <button
          onClick={() => setFilter("all")}
          className="flex items-center gap-2 px-3.5 py-2 rounded-[14px] text-sm font-semibold transition-all ml-auto"
          style={{
            background: filter === "all" ? "rgba(47,158,68,0.12)" : "rgba(238,243,239,0.8)",
            border: `1px solid ${filter === "all" ? "#2f9e44" : "#d9e5dc"}`,
            color: filter === "all" ? "#2f9e44" : "#6b7c72",
          }}
        >
          All Logs: {logs.length}
        </button>
      </div>

      {/* Main card */}
      <div className="rounded-[28px] overflow-hidden"
        style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 4px 32px rgba(47,158,68,0.07)" }}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: "#d9e5dc" }}>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3.5 py-2.5 rounded-[14px]"
            style={{ background: "rgba(238,243,239,0.8)", border: "1px solid #d9e5dc" }}>
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#6b7c72" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#1e2b22" }}
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-[14px] text-sm font-medium"
              style={{ background: "rgba(238,243,239,0.8)", border: "1px solid #d9e5dc", color: "#6b7c72" }}
            >
              <Filter className="w-4 h-4" />
              {filter === "all" ? "All Status" : statusConfig[filter as keyof typeof statusConfig].label}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
              {showFilter && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-12 left-0 z-20 w-40 rounded-[16px] overflow-hidden shadow-xl"
                  style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}
                >
                  {(["all", "success", "warning", "error", "info"] as Status[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setFilter(s); setShowFilter(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-green-50 transition-colors text-left capitalize"
                      style={{ color: s === "all" ? "#1e2b22" : statusConfig[s as keyof typeof statusConfig]?.color || "#1e2b22" }}
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-[14px] text-sm font-medium"
            style={{ background: "rgba(47,158,68,0.08)", color: "#2f9e44", border: "1px solid rgba(47,158,68,0.2)" }}>
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button onClick={clearLogs}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-[14px] text-sm font-medium"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[100px_140px_1fr_100px_140px] gap-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "#6b7c72", background: "rgba(238,243,239,0.5)" }}>
          <span>Time</span>
          <span>Sensor</span>
          <span>Event</span>
          <span>Status</span>
          <span>AI Result</span>
        </div>

        {/* Log Rows */}
        <div className="divide-y overflow-y-auto" style={{ divideColor: "#eef3ef", maxHeight: 520 }}>
          <AnimatePresence initial={false}>
            {filtered.map((log, i) => {
              const { icon: Icon, color, bg } = statusConfig[log.status];
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                  transition={{ duration: 0.2, delay: i < 5 ? i * 0.03 : 0 }}
                  whileHover={{ backgroundColor: "rgba(238,243,239,0.8)" }}
                  className="grid grid-cols-[100px_140px_1fr_100px_140px] gap-4 items-center px-5 py-3 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 flex-shrink-0" style={{ color: "#9bb8a4" }} />
                    <span className="text-xs font-mono" style={{ color: "#6b7c72" }}>{log.time}</span>
                  </div>
                  <div className="text-xs font-medium truncate" style={{ color: "#1e2b22" }}>
                    {log.sensor}
                  </div>
                  <div className="text-xs truncate" style={{ color: "#1e2b22" }}>
                    {log.event}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: bg, color }}>
                      <Icon className="w-3 h-3" />
                      {log.status}
                    </span>
                  </div>
                  <div className="text-xs font-mono truncate" style={{ color: "#6b7c72" }}>
                    {log.aiResult || "—"}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="w-10 h-10 mb-3" style={{ color: "#d9e5dc" }} />
              <p className="text-sm font-semibold" style={{ color: "#6b7c72" }}>No logs found</p>
              <p className="text-xs mt-1" style={{ color: "#9bb8a4" }}>Try a different search or filter</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "#d9e5dc" }}>
          <span className="text-xs" style={{ color: "#6b7c72" }}>
            Showing {filtered.length} of {logs.length} entries
          </span>
          <div className="flex items-center gap-1.5">
            <span className="pulse-dot" />
            <span className="text-xs" style={{ color: "#2f9e44" }}>Live updating</span>
          </div>
        </div>
      </div>
    </div>
  );
}
