"use client";

import { useAgriStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const severityConfig = {
  high: { border: "#ef4444", icon: AlertCircle, iconColor: "#ef4444", bg: "rgba(239,68,68,0.08)" },
  medium: { border: "#f4c542", icon: AlertTriangle, iconColor: "#f4c542", bg: "rgba(244,197,66,0.08)" },
  low: { border: "#22c55e", icon: Info, iconColor: "#22c55e", bg: "rgba(34,197,94,0.08)" },
};

export default function CriticalAlertsCard() {
  const { alerts, resolveAlert } = useAgriStore();
  const activeAlerts = alerts.filter((a) => !a.resolved).slice(0, 5);

  return (
    <div
      className="rounded-[28px] p-6 flex flex-col"
      style={{
        background: "linear-gradient(165deg, #fef9eb 0%, #fdf3d7 100%)",
        border: "1px solid rgba(244,197,66,0.35)",
        boxShadow: "0 4px 32px rgba(244,197,66,0.15)",
        minHeight: 300,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-base" style={{ color: "#1e2b22" }}>Critical Alerts</h3>
          <p className="text-xs mt-0.5" style={{ color: "#6b7c72" }}>
            {activeAlerts.length} active issue{activeAlerts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: activeAlerts.some(a => a.severity === "high") ? "#ef4444" : "#f4c542" }} />
          <button className="text-xs font-medium px-3 py-1.5 rounded-xl"
            style={{ color: "#e6a820", background: "rgba(230,168,32,0.12)" }}>
            See All
          </button>
        </div>
      </div>

      <div className="space-y-2.5 flex-1">
        <AnimatePresence>
          {activeAlerts.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-3 p-3 rounded-[16px] relative"
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}25`,
                  borderLeft: `3px solid ${cfg.border}`,
                }}
              >
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cfg.border}15` }}>
                  <Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#1e2b22" }}>{alert.title}</p>
                  <p className="text-xs mt-0.5 leading-tight" style={{ color: "#6b7c72" }}>
                    {alert.description}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: "#9bb8a4" }}>
                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-red-100"
                  style={{ color: "#9bb8a4" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {activeAlerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <CheckCircle2 className="w-10 h-10 mb-2" style={{ color: "#22c55e" }} />
            <p className="text-sm font-semibold" style={{ color: "#1e2b22" }}>All Clear!</p>
            <p className="text-xs mt-1" style={{ color: "#6b7c72" }}>No active alerts</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
