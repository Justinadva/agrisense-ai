"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf, Camera, AlertTriangle, CheckCircle2,
  Activity, Loader2, Wifi, WifiOff, RefreshCw, Sprout,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL ?? "https://fa0507456dfd06.lhr.life";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DetectionBox {
  x: number;       // 0–1 ratio
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  color: string;   // hex
}

interface DetectResponse {
  success: boolean;
  boxes: DetectionBox[];
  summary: string;
  image_base64: string;
}

type PageState = "idle" | "loading" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isHealthy(summary: string) {
  return /healthy|sehat|fresh/i.test(summary);
}

function SummaryBadge({ summary }: { summary: string }) {
  const healthy = isHealthy(summary);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 px-5 py-3 rounded-2xl"
      style={{
        background: healthy ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        border: `1.5px solid ${healthy ? "#22c55e" : "#ef4444"}`,
      }}
    >
      {healthy
        ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#22c55e" }} />
        : <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
      }
      <span className="font-bold text-base" style={{ color: healthy ? "#16a34a" : "#dc2626" }}>
        {summary}
      </span>
    </motion.div>
  );
}

// ─── Bounding Box Overlay (SVG) ───────────────────────────────────────────────
function BoundingBoxOverlay({
  boxes,
  width,
  height,
}: {
  boxes: DetectionBox[];
  width: number;
  height: number;
}) {
  if (!boxes.length || !width || !height) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ overflow: "visible" }}
    >
      {boxes.map((box, i) => {
        const px = box.x * width;
        const py = box.y * height;
        const pw = box.width * width;
        const ph = box.height * height;
        const label = `${box.label} ${(box.confidence * 100).toFixed(0)}%`;
        const fontSize = Math.max(11, Math.min(14, pw / 10));
        const badgeH = fontSize + 10;

        return (
          <g key={i}>
            {/* Glow rect */}
            <rect
              x={px} y={py} width={pw} height={ph}
              fill="none"
              stroke={box.color}
              strokeWidth={2.5}
              strokeOpacity={0.9}
              filter="url(#glow)"
            />
            {/* Corner marks */}
            {[
              [px, py, 1, 0, 0, 1],
              [px + pw, py, -1, 0, 0, 1],
              [px, py + ph, 1, 0, 0, -1],
              [px + pw, py + ph, -1, 0, 0, -1],
            ].map(([sx, sy, dx1, dy1, dx2, dy2], ci) => {
              const cs = Math.min(pw, ph) * 0.18;
              return (
                <polyline
                  key={ci}
                  points={`${sx + dx1 * cs},${sy + dy1 * cs} ${sx},${sy} ${sx + dx2 * cs},${sy + dy2 * cs}`}
                  fill="none"
                  stroke={box.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Label badge */}
            <rect
              x={px}
              y={py - badgeH < 0 ? py + 3 : py - badgeH - 2}
              width={label.length * fontSize * 0.6 + 14}
              height={badgeH}
              rx={5}
              fill={box.color}
              fillOpacity={0.92}
            />
            <text
              x={px + 7}
              y={py - badgeH < 0 ? py + 3 + fontSize : py - 6}
              fontSize={fontSize}
              fontWeight="bold"
              fill="#fff"
              fontFamily="Inter, sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AIDetectionPage() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [result, setResult]       = useState<DetectResponse | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const [serverOk, setServerOk]   = useState<boolean | null>(null);
  const [imgSize, setImgSize]     = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // ── Ping server health ───────────────────────────────────────────────────────
  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch(`${AI_API_URL}/health`, {
          signal: AbortSignal.timeout(4000),
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        setServerOk(r.ok);
      } catch {
        setServerOk(false);
      }
    };
    ping();
    const id = setInterval(ping, 15000);
    return () => clearInterval(id);
  }, []);

  // ── Main action ──────────────────────────────────────────────────────────────
  const handleDetect = async () => {
    setPageState("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch(`${AI_API_URL}/detect`, {
        method: "GET",
        signal: AbortSignal.timeout(30000), // 30s timeout — Raspberry Pi can be slow
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);

      const data = (await res.json()) as DetectResponse;

      if (!data.success) throw new Error("Server melaporkan deteksi gagal.");

      setResult(data);
      setServerOk(true);
      setPageState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal terhubung ke kamera kebun.";
      setErrorMsg(msg);
      setServerOk(false);
      setPageState("error");
    }
  };

  // ── Update image natural size for overlay ────────────────────────────────────
  const handleImgLoad = () => {
    if (imgRef.current) {
      setImgSize({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1200px] mx-auto pt-4">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>
            Remote AI Detection
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
            Edge AI · Raspberry Pi di Kebun · YOLOv8 Plant Disease Detection
          </p>
        </div>

        {/* Server status badge */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{
            background: serverOk === true
              ? "rgba(34,197,94,0.1)"
              : serverOk === false
              ? "rgba(239,68,68,0.1)"
              : "rgba(148,163,184,0.1)",
            border: `1px solid ${serverOk === true ? "rgba(34,197,94,0.4)" : serverOk === false ? "rgba(239,68,68,0.35)" : "rgba(148,163,184,0.3)"}`,
            color: serverOk === true ? "#16a34a" : serverOk === false ? "#dc2626" : "#64748b",
          }}
        >
          {serverOk === true  && <Wifi className="w-3.5 h-3.5" />}
          {serverOk === false && <WifiOff className="w-3.5 h-3.5" />}
          {serverOk === null  && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>
            {serverOk === true ? "Raspberry Pi Online" : serverOk === false ? "Server Offline" : "Memeriksa koneksi…"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* ── Left: Main panel ────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Action card */}
          <div
            className="rounded-[28px] overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0d1f16 0%, #1a3326 100%)",
              border: "1px solid rgba(47,158,68,0.25)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
            }}
          >
            {/* Card header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "rgba(47,158,68,0.15)" }}
            >
              <div className="flex items-center gap-2.5">
                <Sprout className="w-4 h-4 text-green-400" />
                <span className="text-green-300 text-sm font-semibold">
                  Kamera Kebun — Remote Edge AI
                </span>
              </div>
              {pageState === "done" && result && (
                <button
                  onClick={handleDetect}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: "rgba(47,158,68,0.2)",
                    border: "1px solid rgba(47,158,68,0.4)",
                    color: "#4ade80",
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Ulangi
                </button>
              )}
            </div>

            {/* Card body */}
            <div className="p-6 flex flex-col items-center gap-6" style={{ minHeight: 420 }}>

              {/* ─── IDLE ─── */}
              {pageState === "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-6 my-auto"
                >
                  {/* Animated plant icon ring */}
                  <div className="relative">
                    <div
                      className="w-28 h-28 rounded-full flex items-center justify-center"
                      style={{
                        background: "radial-gradient(circle, rgba(47,158,68,0.2) 0%, rgba(47,158,68,0.05) 70%)",
                        border: "2px solid rgba(47,158,68,0.35)",
                        boxShadow: "0 0 40px rgba(47,158,68,0.2)",
                      }}
                    >
                      <Leaf className="w-12 h-12 text-green-400" />
                    </div>
                    <div
                      className="absolute -inset-3 rounded-full border border-green-400/20 animate-ping"
                      style={{ animationDuration: "2.5s" }}
                    />
                  </div>

                  <div className="text-center">
                    <p className="text-green-200 font-semibold text-lg mb-1">
                      Siap Menganalisis Tanaman
                    </p>
                    <p className="text-green-700 text-sm max-w-xs">
                      Tekan tombol di bawah untuk memerintahkan kamera Raspberry Pi di kebun
                      memotret dan menganalisis kondisi tanaman secara otomatis.
                    </p>
                  </div>

                  {/* Main CTA button */}
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: "0 0 40px rgba(47,158,68,0.5)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDetect}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base"
                    style={{
                      background: "linear-gradient(135deg, #2f9e44 0%, #1a7a30 100%)",
                      color: "#fff",
                      boxShadow: "0 8px 32px rgba(47,158,68,0.35)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <Camera className="w-5 h-5" />
                    Cek Tanaman di Kebun
                  </motion.button>
                </motion.div>
              )}

              {/* ─── LOADING ─── */}
              {pageState === "loading" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-5 my-auto"
                >
                  {/* Pulse rings */}
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full" style={{ background: "rgba(47,158,68,0.15)", border: "2px solid rgba(47,158,68,0.4)" }}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" style={{ animationDuration: "1.5s" }} />
                    <div className="absolute -inset-4 rounded-full border border-green-500/15 animate-ping" style={{ animationDuration: "2s" }} />
                  </div>

                  <div className="text-center space-y-1.5">
                    <p className="text-green-300 font-semibold">Menghubungi Kamera Kebun…</p>
                    <p className="text-green-700 text-sm max-w-xs">
                      Memerintahkan kamera kebun untuk memotret dan menganalisis tanaman kamu…
                    </p>
                  </div>

                  {/* Animated dots */}
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-green-400"
                        style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─── ERROR ─── */}
              {pageState === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-5 my-auto w-full max-w-sm"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.4)" }}
                  >
                    <WifiOff className="w-9 h-9 text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-red-300 font-semibold mb-1">Gagal Terhubung</p>
                    <p className="text-red-900 text-xs font-mono px-4 py-2 rounded-xl max-w-xs break-all"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      {errorMsg}
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDetect}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      color: "#f87171",
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Coba Lagi
                  </motion.button>
                </motion.div>
              )}

              {/* ─── DONE: Image + bounding boxes ─── */}
              {pageState === "done" && result && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full flex flex-col gap-5"
                >
                  {/* Image with bounding box overlay */}
                  <div
                    className="relative w-full rounded-[20px] overflow-hidden"
                    style={{ border: "1.5px solid rgba(47,158,68,0.3)", background: "#000" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imgRef}
                      src={result.image_base64}
                      alt="Hasil jepretan kamera kebun"
                      className="w-full h-auto block"
                      onLoad={handleImgLoad}
                      style={{ display: "block" }}
                    />
                    {/* SVG overlay */}
                    <BoundingBoxOverlay
                      boxes={result.boxes}
                      width={imgSize.w}
                      height={imgSize.h}
                    />

                    {/* Top badge */}
                    <div
                      className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[11px] font-mono text-green-300">
                        {result.boxes.length} objek terdeteksi
                      </span>
                    </div>
                  </div>

                  {/* Summary badge */}
                  <SummaryBadge summary={result.summary} />

                  {/* Boxes list */}
                  {result.boxes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AnimatePresence>
                        {result.boxes.map((box, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-[16px]"
                            style={{
                              background: `${box.color}15`,
                              border: `1.5px solid ${box.color}50`,
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ background: box.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "#1e2b22" }}>
                                {box.label}
                              </p>
                            </div>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: `${box.color}25`, color: box.color }}
                            >
                              {(box.confidence * 100).toFixed(0)}%
                            </span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* CTA again */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDetect}
                    className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl font-bold text-sm"
                    style={{
                      background: "linear-gradient(135deg, #2f9e44 0%, #1a7a30 100%)",
                      color: "#fff",
                      boxShadow: "0 4px 20px rgba(47,158,68,0.3)",
                    }}
                  >
                    <Camera className="w-4 h-4" />
                    Cek Lagi Sekarang
                  </motion.button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Info panel ───────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Connection info */}
          <div
            className="rounded-[24px] p-5"
            style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" style={{ color: "#2f9e44" }} />
              <h3 className="font-bold text-sm" style={{ color: "#1e2b22" }}>
                Informasi Server
              </h3>
            </div>
            <div className="space-y-3 text-xs">
              {[
                { label: "Endpoint", value: AI_API_URL, mono: true },
                { label: "Metode",   value: "GET /detect" },
                { label: "AI Model", value: "YOLOv8 · best.pt" },
                { label: "Status",   value: serverOk === true ? "Online ✓" : serverOk === false ? "Offline ✗" : "Memeriksa…" },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span style={{ color: "#6b7c72" }}>{label}</span>
                  <span
                    className={`text-right break-all ${mono ? "font-mono text-[10px]" : "font-medium"}`}
                    style={{ color: "#1e2b22", maxWidth: "60%" }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div
            className="rounded-[24px] p-5"
            style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}
          >
            <h3 className="font-bold text-sm mb-4" style={{ color: "#1e2b22" }}>
              Cara Kerja
            </h3>
            <ol className="space-y-3">
              {[
                { step: "1", text: "Tombol \"Cek Tanaman\" ditekan" },
                { step: "2", text: "Raspberry Pi di kebun menerima perintah" },
                { step: "3", text: "Kamera memotret kondisi tanaman terkini" },
                { step: "4", text: "YOLOv8 menganalisis gambar secara lokal" },
                { step: "5", text: "Hasil dikirim balik ke dashboard ini" },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: "rgba(47,158,68,0.15)", color: "#2f9e44", border: "1px solid rgba(47,158,68,0.3)" }}
                  >
                    {step}
                  </span>
                  <span className="text-xs" style={{ color: "#4b6f5c" }}>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Disease legend */}
          <div
            className="rounded-[24px] p-5"
            style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}
          >
            <h3 className="font-bold text-sm mb-4" style={{ color: "#1e2b22" }}>
              Label Penyakit
            </h3>
            <div className="space-y-2">
              {[
                { label: "Healthy / Fresh",   color: "#22c55e" },
                { label: "Early Blight",      color: "#ef4444" },
                { label: "Late Blight",       color: "#f97316" },
                { label: "Leaf Mold",         color: "#a78bfa" },
                { label: "Yellow Leaf Curl",  color: "#f4c542" },
                { label: "Rotten",            color: "#6b7280" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs" style={{ color: "#4b6f5c" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 1; }
          40% { transform: translateY(-6px); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
