"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  Droplets,
  LayoutDashboard,
  Activity,
  Eye,
  Waves,
  BarChart3,
  ScrollText,
  Bell,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Menu,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Realtime Monitoring", href: "/realtime", icon: Activity },
  { label: "AI Detection", href: "/ai-detection", icon: Eye },
  { label: "Irrigation", href: "/irrigation", icon: Waves },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Activity Logs", href: "/logs", icon: ScrollText },
];

const mockNotifications = [
  { id: 1, type: "warning", title: "Low Soil Moisture", desc: "Tomato Bed #08 is at 41%", time: "2m ago" },
  { id: 2, type: "error", title: "Early Blight Detected", desc: "AI detected disease on Bed #08", time: "5m ago" },
  { id: 3, type: "success", title: "Pump Activated", desc: "Automatic irrigation started", time: "8m ago" },
  { id: 4, type: "info", title: "AI Scan Complete", desc: "All 12 containers scanned", time: "15m ago" },
];

const notifIcons: Record<string, React.ReactNode> = {
  warning: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

export default function Navbar() {
  const pathname = usePathname();
  const { isDark, toggle } = useTheme();
  const [isConnected, setIsConnected] = useState(true);
  const [showNotif, setShowNotif] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(2);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected((prev) => (Math.random() > 0.05 ? true : !prev));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className="mx-4 mt-3 rounded-[20px] border backdrop-blur-xl"
        style={{
          background: isDark
            ? "rgba(26, 37, 32, 0.92)"
            : "rgba(247, 250, 248, 0.92)",
          borderColor: isDark ? "rgba(47,158,68,0.2)" : "#d9e5dc",
          boxShadow: "0 4px 24px rgba(47,158,68,0.08)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="relative w-9 h-9 flex items-center justify-center rounded-[10px]"
              style={{ background: "linear-gradient(135deg,#2f9e44,#1f6f3d)" }}>
              <Leaf className="w-4 h-4 text-white absolute" style={{ transform: "translate(-1px,-1px)" }} />
              <Droplets className="w-3 h-3 text-emerald-200 absolute" style={{ transform: "translate(3px,3px)" }} />
            </div>
            <div className="leading-none">
              <div className="font-bold text-base tracking-tight"
                style={{ color: isDark ? "#e8f0eb" : "#1e2b22" }}>
                AgriSense
              </div>
              <div className="text-[10px] font-medium" style={{ color: "#6b7c72" }}>
                Smart Farming AI
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    color: active
                      ? "#2f9e44"
                      : isDark ? "#9bb8a4" : "#6b7c72",
                    background: active
                      ? isDark ? "rgba(47,158,68,0.12)" : "rgba(47,158,68,0.08)"
                      : "transparent",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {active && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                      style={{ background: "#2f9e44" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background: isConnected
                  ? "rgba(34,197,94,0.1)"
                  : "rgba(239,68,68,0.1)",
                color: isConnected ? "#22c55e" : "#ef4444",
              }}>
              {isConnected
                ? <Wifi className="w-3.5 h-3.5" />
                : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden md:block">{isConnected ? "Live" : "Offline"}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "animate-pulse" : ""}`}
                style={{ background: isConnected ? "#22c55e" : "#ef4444" }} />
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                background: isDark ? "rgba(47,158,68,0.15)" : "rgba(47,158,68,0.08)",
                color: isDark ? "#4ade80" : "#2f9e44",
              }}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                id="notif-btn"
                onClick={() => { setShowNotif(!showNotif); setUnread(0); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl relative transition-all duration-200"
                style={{
                  background: showNotif
                    ? "rgba(47,158,68,0.15)"
                    : "rgba(47,158,68,0.08)",
                  color: "#2f9e44",
                }}
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ background: "#ef4444" }}>
                    {unread}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotif && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-12 w-80 rounded-[20px] overflow-hidden shadow-xl z-50"
                    style={{
                      background: isDark ? "#1a2520" : "#f7faf8",
                      border: `1px solid ${isDark ? "rgba(47,158,68,0.2)" : "#d9e5dc"}`,
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b"
                      style={{ borderColor: isDark ? "rgba(47,158,68,0.15)" : "#d9e5dc" }}>
                      <span className="font-semibold text-sm" style={{ color: isDark ? "#e8f0eb" : "#1e2b22" }}>
                        Notifications
                      </span>
                      <button onClick={() => setShowNotif(false)}
                        style={{ color: "#6b7c72" }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="divide-y" style={{ divideColor: isDark ? "rgba(47,158,68,0.1)" : "#d9e5dc" }}>
                      {mockNotifications.map((n) => (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors cursor-pointer">
                          <div className="mt-0.5">{notifIcons[n.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate"
                              style={{ color: isDark ? "#e8f0eb" : "#1e2b22" }}>
                              {n.title}
                            </p>
                            <p className="text-xs truncate" style={{ color: "#6b7c72" }}>
                              {n.desc}
                            </p>
                          </div>
                          <span className="text-[10px] flex-shrink-0" style={{ color: "#6b7c72" }}>
                            {n.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu */}
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: "rgba(47,158,68,0.08)", color: "#2f9e44" }}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="lg:hidden overflow-hidden"
            >
              <div className="px-4 pb-4 flex flex-wrap gap-1">
                {navItems.map(({ label, href, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                      style={{
                        color: active ? "#2f9e44" : isDark ? "#9bb8a4" : "#6b7c72",
                        background: active
                          ? "rgba(47,158,68,0.1)"
                          : "transparent",
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
