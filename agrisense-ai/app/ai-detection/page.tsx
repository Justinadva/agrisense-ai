"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Camera, Zap, CheckCircle2, AlertTriangle, Clock, Activity, Wifi, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRef, useEffect, useState, useCallback } from "react";

// ─── AI Server config ─────────────────────────────────────────────────────────
const AI_SERVER = "http://localhost:8000";
const FRAME_INTERVAL_MS = 1500; // kirim frame setiap 1.5 detik

// ─── Types ────────────────────────────────────────────────────────────────────
const labelColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Healthy Leaf": { bg: "rgba(34,197,94,0.15)",  border: "#22c55e", text: "#16a34a", dot: "#22c55e" },
  "Healthy":      { bg: "rgba(34,197,94,0.15)",  border: "#22c55e", text: "#16a34a", dot: "#22c55e" },
  "Early Blight": { bg: "rgba(239,68,68,0.15)",  border: "#ef4444", text: "#dc2626", dot: "#ef4444" },
  "Late Blight":  { bg: "rgba(249,115,22,0.15)", border: "#f97316", text: "#ea580c", dot: "#f97316" },
  "Leaf Spot":    { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", text: "#d97706", dot: "#f59e0b" },
  "Moisture Stress": { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", text: "#2563eb", dot: "#3b82f6" },
};
function getLabelColor(label: string) {
  for (const [key, val] of Object.entries(labelColors)) {
    if (label.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return { bg: "rgba(148,163,184,0.15)", border: "#94a3b8", text: "#64748b", dot: "#94a3b8" };
}

interface BoundingBox {
  x: number; y: number; width: number; height: number;
  label: string; confidence: number; color: string;
}
interface AIResult {
  boxes: BoundingBox[];
  inference_ms: number;
  summary: string;
}

type CamStatus = "idle" | "requesting" | "active" | "error" | "denied";
interface VideoDevice { deviceId: string; label: string; }

// ─── LiveCameraFeed ───────────────────────────────────────────────────────────
function LiveCameraFeed({ onDetection }: { onDetection?: (r: AIResult) => void }) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const overlayRef   = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const captureTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus]           = useState<CamStatus>("requesting");
  const [errorMsg, setErrorMsg]       = useState("");
  const [devices, setDevices]         = useState<VideoDevice[]>([]);
  const [selectedId, setSelectedId]   = useState("");
  const [showPicker, setShowPicker]   = useState(false);
  const [time, setTime]               = useState("");
  const [aiResult, setAiResult]       = useState<AIResult | null>(null);
  const [aiServerOk, setAiServerOk]   = useState<boolean | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Live clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("id-ID", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Check AI server availability
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${AI_SERVER}/health`, { signal: AbortSignal.timeout(2000) });
        setAiServerOk(r.ok);
      } catch {
        setAiServerOk(false);
      }
    };
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  // Enumerate cameras
  const refreshDevices = async (): Promise<VideoDevice[]> => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all
        .filter(d => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Kamera ${i + 1}` }));
      setDevices(cams);
      return cams;
    } catch { return []; }
  };

  // Draw bounding boxes on overlay canvas
  const drawOverlay = useCallback((boxes: BoundingBox[]) => {
    const canvas = overlayRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = video.videoWidth  || canvas.offsetWidth;
    canvas.height = video.videoHeight || canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    boxes.forEach(({ x, y, width, height, label, confidence, color }) => {
      const px = x * canvas.width;
      const py = y * canvas.height;
      const pw = width  * canvas.width;
      const ph = height * canvas.height;

      // Box shadow glow
      ctx.shadowColor = color;
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.strokeRect(px, py, pw, ph);
      ctx.shadowBlur  = 0;

      // Corner marks
      const cs = Math.min(pw, ph) * 0.2;
      ctx.lineWidth   = 3;
      [
        [px, py, cs, 0, 0, cs],
        [px+pw, py, -cs, 0, 0, cs],
        [px, py+ph, cs, 0, 0, -cs],
        [px+pw, py+ph, -cs, 0, 0, -cs],
      ].forEach(([sx, sy, dx1, dy1, dx2, dy2]) => {
        ctx.beginPath();
        ctx.moveTo(sx + dx1, sy + dy1); ctx.lineTo(sx, sy); ctx.lineTo(sx + dx2, sy + dy2);
        ctx.stroke();
      });

      // Label badge
      const text  = `${label} ${(confidence * 100).toFixed(0)}%`;
      const fSize = Math.max(11, Math.min(14, pw / 10));
      ctx.font = `bold ${fSize}px Inter, sans-serif`;
      const tw  = ctx.measureText(text).width;
      const bh  = fSize + 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      const bx = px;
      const by = py - bh < 0 ? py + 2 : py - bh - 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw + 12, bh, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.fillText(text, bx + 6, by + fSize);
    });
  }, []);

  // Capture frame → send to AI server
  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isDetecting || aiServerOk === false) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const b64 = canvas.toDataURL("image/jpeg", 0.8);

    setIsDetecting(true);
    try {
      const res = await fetch(`${AI_SERVER}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64 }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as AIResult;
      setAiResult(data);
      drawOverlay(data.boxes);
      onDetection?.(data);
      setAiServerOk(true);
    } catch {
      setAiServerOk(false);
    } finally {
      setIsDetecting(false);
    }
  }, [isDetecting, aiServerOk, drawOverlay, onDetection]);

  // Start/stop frame capture loop when camera is active
  useEffect(() => {
    if (status === "active") {
      captureTimer.current = setInterval(captureAndDetect, FRAME_INTERVAL_MS);
    }
    return () => {
      if (captureTimer.current) clearInterval(captureTimer.current);
    };
  }, [status, captureAndDetect]);

  // Start camera
  const startCamera = async (deviceId?: string) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStatus("requesting");
    setErrorMsg("");
    setAiResult(null);
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext("2d");
      ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }

    try {
      const constraint: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: true, audio: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      const cams   = await refreshDevices();

      if (!deviceId && cams.length > 1) {
        const ext = cams.find(c => !/integrated|built.?in|internal|facetime/i.test(c.label));
        const picked = ext ?? cams[cams.length - 1];
        if (picked.deviceId !== stream.getVideoTracks()[0]?.getSettings().deviceId) {
          stream.getTracks().forEach(t => t.stop());
          setSelectedId(picked.deviceId);
          await startCamera(picked.deviceId);
          return;
        } else { setSelectedId(picked.deviceId); }
      } else if (deviceId) { setSelectedId(deviceId); }
      else if (cams.length === 1) { setSelectedId(cams[0].deviceId); }

      streamRef.current = stream;
      setStatus("active");
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setStatus("denied"); setErrorMsg("Akses kamera ditolak. Izinkan kamera di pengaturan browser.");
      } else if (e.name === "NotFoundError") {
        setStatus("error"); setErrorMsg("Kamera tidak ditemukan.");
      } else { setStatus("error"); setErrorMsg(e.message ?? "Gagal mengakses kamera."); }
    }
  };

  // Attach stream to <video> after React renders it
  useEffect(() => {
    if (status === "active" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("[Camera] play() failed:", e));
    }
  }, [status]);

  // Auto-start on mount
  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (captureTimer.current) clearInterval(captureTimer.current);
    setStatus("idle");
    setAiResult(null);
  };

  const switchCamera = async (id: string) => {
    setShowPicker(false);
    setSelectedId(id);
    await startCamera(id);
  };

  // ── Requesting / Idle ──────────────────────────────────────────────────────
  if (status === "idle" || status === "requesting") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 rounded-[20px]"
        style={{ background: "linear-gradient(135deg,#0f2218,#1a3326)", minHeight: 320 }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(47,158,68,0.15)", border: "1.5px solid rgba(47,158,68,0.4)" }}>
          <Camera className="w-7 h-7 text-green-400" />
        </div>
        <p className="text-green-300 font-semibold text-sm">
          {status === "requesting" ? "Meminta izin kamera…" : "Kamera belum aktif"}
        </p>
        {status === "requesting" && (
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400"
                style={{ animation: `bounce 1.2s ${i*0.2}s infinite` }} />
            ))}
          </div>
        )}
        {status === "idle" && (
          <button onClick={() => startCamera()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(47,158,68,0.25)", border: "1px solid rgba(47,158,68,0.5)", color: "#4ade80" }}>
            <Camera className="w-4 h-4" /> Aktifkan Kamera
          </button>
        )}
      </div>
    );
  }

  // ── Error / Denied ─────────────────────────────────────────────────────────
  if (status === "error" || status === "denied") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 rounded-[20px]"
        style={{ background: "linear-gradient(135deg,#1e0f0f,#2b1515)", minHeight: 320 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.15)", border: "1.5px solid rgba(239,68,68,0.4)" }}>
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-red-300 font-semibold text-sm">{status === "denied" ? "Akses Ditolak" : "Kamera Error"}</p>
        <p className="text-red-700 text-xs max-w-[260px] text-center">{errorMsg}</p>
        <button onClick={() => startCamera()} className="px-4 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
          Coba Lagi
        </button>
      </div>
    );
  }

  // ── Active stream ──────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full rounded-[20px] overflow-hidden" style={{ minHeight: 320, background: "#000" }}>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ display: "block" }} />

      {/* Bounding box overlay canvas */}
      <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: "cover" }} />

      {/* HUD corners */}
      <div className="absolute inset-0 pointer-events-none">
        {["top-2 left-2","top-2 right-2","bottom-2 left-2","bottom-2 right-2"].map(pos => (
          <span key={pos} className={`absolute ${pos} w-6 h-6`}
            style={{ borderColor: "rgba(47,158,68,0.7)", borderWidth: 2,
              borderTopWidth: pos.includes("bottom") ? 0 : 2, borderBottomWidth: pos.includes("top") ? 0 : 2,
              borderLeftWidth: pos.includes("right") ? 0 : 2, borderRightWidth: pos.includes("left") ? 0 : 2 }} />
        ))}

        {/* Scan line */}
        <div className="absolute inset-x-0" style={{
          height: 2, background: "linear-gradient(90deg,transparent,rgba(47,158,68,0.5),transparent)",
          animation: "scan 3s linear infinite",
        }} />

        {/* Bottom bar */}
        <div className="absolute bottom-0 inset-x-0 px-3 py-1.5 flex items-center justify-between"
          style={{ background: "linear-gradient(0deg,rgba(0,0,0,0.7),transparent)" }}>
          <span className="text-[10px] font-mono" style={{ color: "rgba(74,222,128,0.85)" }}>LIVE • {time}</span>
          {aiResult && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.5)", color: "#4ade80" }}>
              {aiResult.summary} • {aiResult.inference_ms}ms
            </span>
          )}
          <span className="text-[10px] font-mono" style={{ color: "rgba(74,222,128,0.85)" }}>AI VISION</span>
        </div>
      </div>

      {/* AI detecting pulse */}
      {isDetecting && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(47,158,68,0.4)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono text-green-300">Detecting…</span>
        </div>
      )}

      {/* Controls — top right */}
      <div className="absolute top-2 right-2 flex gap-2 pointer-events-auto z-10">

        {/* AI server status badge */}
        <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg"
          style={{ background: "rgba(0,0,0,0.55)",
            border: `1px solid ${aiServerOk === true ? "rgba(47,158,68,0.5)" : aiServerOk === false ? "rgba(239,68,68,0.4)" : "rgba(100,100,100,0.4)"}` }}>
          {aiServerOk === true  && <Wifi className="w-3.5 h-3.5 text-green-400" />}
          {aiServerOk === false && <WifiOff className="w-3.5 h-3.5 text-red-400" />}
          {aiServerOk === null  && <div className="w-3.5 h-3.5 rounded-full border border-gray-400 animate-spin border-t-transparent" />}
          <span className="text-[10px] font-mono hidden sm:inline"
            style={{ color: aiServerOk === true ? "#4ade80" : aiServerOk === false ? "#f87171" : "#9ca3af" }}>
            {aiServerOk === true ? "AI Server" : aiServerOk === false ? "Server Off" : "Checking…"}
          </span>
        </div>

        {/* Camera picker */}
        {devices.length > 1 && (
          <div className="relative">
            <button onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg backdrop-blur text-xs font-medium"
              style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(47,158,68,0.5)", color: "#4ade80" }}>
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ganti Kamera</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showPicker && (
              <div className="absolute right-0 top-10 min-w-[220px] rounded-xl overflow-hidden z-20"
                style={{ background: "rgba(15,34,24,0.97)", border: "1px solid rgba(47,158,68,0.35)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(47,158,68,0.15)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#4ade80" }}>Pilih Kamera</p>
                </div>
                {devices.map((dev, i) => (
                  <button key={dev.deviceId} onClick={() => switchCamera(dev.deviceId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-green-900/30">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: dev.deviceId === selectedId ? "rgba(47,158,68,0.3)" : "rgba(255,255,255,0.05)" }}>
                      <Camera className="w-3 h-3" style={{ color: dev.deviceId === selectedId ? "#4ade80" : "#6b7c72" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: dev.deviceId === selectedId ? "#4ade80" : "#d1fae5" }}>
                        {dev.label}
                      </p>
                      <p className="text-[10px]" style={{ color: "#4b6f5c" }}>
                        {i === 0 ? "Kamera Bawaan" : "Kamera Eksternal"}{dev.deviceId === selectedId && " · Aktif"}
                      </p>
                    </div>
                    {dev.deviceId === selectedId && <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stop */}
        <button onClick={stopCamera} title="Matikan kamera"
          className="w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur"
          style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <style>{`@keyframes scan { 0% { top:0% } 100% { top:100% } }`}</style>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AIDetectionPage() {
  useRealtimeData();
  const { detections, addDetection } = useAgriStore();

  const handleDetection = useCallback((result: AIResult) => {
    if (result.boxes.length === 0) return;
    const top = result.boxes.reduce((a, b) => a.confidence > b.confidence ? a : b);
    addDetection({
      id: `ai-${Date.now()}`,
      label: top.label,
      confidence: Math.round(top.confidence * 100),
      timestamp: new Date(),
      cameraSource: "Webcam (YOLOv8)",
      imageColor: top.color,
    });
  }, [addDetection]);

  const totalToday = detections.length + 47;
  const healthy    = detections.filter(d => /healthy/i.test(d.label)).length;
  const diseases   = detections.filter(d => !/healthy/i.test(d.label)).length;
  const avgConf    = detections.length
    ? Math.round(detections.reduce((a, d) => a + d.confidence, 0) / detections.length)
    : 0;

  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>AI Detection</h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
          Live Computer Vision · YOLOv8 Plant Disease Detection
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
        {/* Left: Camera + Stats */}
        <div className="flex flex-col gap-5">
          {/* Camera Feed */}
          <div className="rounded-[28px] overflow-hidden relative"
            style={{ background: "#0f2218", border: "1px solid rgba(47,158,68,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "rgba(47,158,68,0.15)" }}>
              <div className="flex items-center gap-2.5">
                <span className="pulse-dot" />
                <span className="text-green-300 text-sm font-semibold">Live Camera Feed — YOLOv8 AI</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>● REC</span>
                <Camera className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <div style={{ minHeight: 360 }}>
              <LiveCameraFeed onDetection={handleDetection} />
            </div>
          </div>

          {/* AI Server status banner (if offline) */}
          <div className="rounded-[20px] px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#f97316" }} />
            <div className="text-xs" style={{ color: "#6b7c72" }}>
              <span className="font-semibold" style={{ color: "#f97316" }}>Jalankan AI Server</span>
              {" "}untuk deteksi real-time:{" "}
              <code className="px-1.5 py-0.5 rounded text-[11px]"
                style={{ background: "rgba(0,0,0,0.1)", color: "#1e2b22" }}>
                double-click ai-server/start.bat
              </code>
              {" "}lalu letakkan{" "}
              <code className="px-1.5 py-0.5 rounded text-[11px]"
                style={{ background: "rgba(0,0,0,0.1)", color: "#1e2b22" }}>
                best (10) (2).pt
              </code>
              {" "}di folder <code className="text-[11px]" style={{ color: "#1e2b22" }}>ai-server/</code>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Detections", value: totalToday, suffix: "", icon: Eye, color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
              { label: "Avg Confidence",   value: avgConf,    suffix: "%", icon: Zap, color: "#f4c542", bg: "rgba(244,197,66,0.1)" },
              { label: "Healthy",          value: healthy,    suffix: "", icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
              { label: "Disease Found",    value: diseases,   suffix: "", icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
            ].map(({ label, value, suffix, icon: Icon, color, bg }) => (
              <motion.div key={label} whileHover={{ y: -4 }}
                className="rounded-[20px] p-4" style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}>
                <div className="w-9 h-9 rounded-[12px] flex items-center justify-center mb-3" style={{ background: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: "#1e2b22" }}>{value}{suffix}</div>
                <div className="text-xs mt-0.5" style={{ color: "#6b7c72" }}>{label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Detection Feed */}
        <div className="rounded-[28px] flex flex-col overflow-hidden"
          style={{ background: "#f7faf8", border: "1px solid #d9e5dc", boxShadow: "0 4px 32px rgba(47,158,68,0.07)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#d9e5dc" }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: "#2f9e44" }} />
              <h3 className="font-bold text-sm" style={{ color: "#1e2b22" }}>Live Detection Feed</h3>
            </div>
            <span className="pulse-dot" />
          </div>

          <div className="flex-1 overflow-y-auto divide-y" style={{ maxHeight: 560 }}>
            <AnimatePresence initial={false}>
              {detections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Eye className="w-10 h-10 mb-3" style={{ color: "#d9e5dc" }} />
                  <p className="text-sm font-medium" style={{ color: "#9bb8a4" }}>Menunggu deteksi…</p>
                  <p className="text-xs mt-1" style={{ color: "#b8cfc0" }}>Arahkan kamera ke tanaman</p>
                </div>
              )}
              {detections.map((d) => {
                const c = getLabelColor(d.label);
                return (
                  <motion.div key={d.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 px-5 py-3">
                    <div className="w-10 h-10 rounded-[12px] flex-shrink-0 flex items-center justify-center"
                      style={{ background: c.bg, border: `2px solid ${c.border}` }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: d.imageColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate" style={{ color: "#1e2b22" }}>{d.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: c.bg, color: c.text }}>{d.confidence}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Camera className="w-3 h-3 flex-shrink-0" style={{ color: "#6b7c72" }} />
                        <span className="text-xs truncate" style={{ color: "#6b7c72" }}>{d.cameraSource}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" style={{ color: "#9bb8a4" }} />
                      <span className="text-[10px]" style={{ color: "#9bb8a4" }} suppressHydrationWarning>
                        {formatDistanceToNow(d.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
