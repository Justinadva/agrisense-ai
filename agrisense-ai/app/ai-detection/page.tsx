"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Camera, Zap, CheckCircle2, AlertTriangle, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRef, useEffect, useState } from "react";

const labelColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Healthy Leaf": { bg: "rgba(34,197,94,0.15)", border: "#22c55e", text: "#16a34a", dot: "#22c55e" },
  "Early Blight": { bg: "rgba(239,68,68,0.15)", border: "#ef4444", text: "#dc2626", dot: "#ef4444" },
  "Leaf Spot": { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", text: "#d97706", dot: "#f59e0b" },
  "Moisture Stress": { bg: "rgba(59,130,246,0.15)", border: "#3b82f6", text: "#2563eb", dot: "#3b82f6" },
};

function LiveCameraFeed() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    function draw() {
      if (!ctx || !canvas) return;
      t += 0.02;
      // Background - simulated plant environment
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, "#1a3326");
      bgGrad.addColorStop(1, "#0f2218");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = "rgba(47,158,68,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Simulated plant leaves
      const drawLeaf = (x: number, y: number, size: number, rot: number, health: boolean) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = health
          ? `rgba(34,197,94,${0.4 + Math.sin(t + x) * 0.1})`
          : `rgba(139,90,43,${0.4 + Math.sin(t + x) * 0.1})`;
        ctx.fill();
        if (!health) {
          // Blight spots
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(
              (Math.sin(i * 2.1) * size * 0.3),
              (Math.cos(i * 1.7) * size * 0.15),
              size * 0.08, 0, Math.PI * 2
            );
            ctx.fillStyle = "rgba(139,90,43,0.7)";
            ctx.fill();
          }
        }
        ctx.restore();
      };

      drawLeaf(120, 140, 55, -0.3 + Math.sin(t * 0.5) * 0.05, true);
      drawLeaf(280, 120, 50, 0.5 + Math.sin(t * 0.4) * 0.05, false);
      drawLeaf(200, 180, 45, -0.8 + Math.sin(t * 0.6) * 0.05, true);
      drawLeaf(350, 200, 52, 0.2 + Math.sin(t * 0.3) * 0.05, true);
      drawLeaf(80, 220, 40, -0.5, true);

      // Bounding boxes
      const boxes = [
        { x: 245, y: 80, w: 90, h: 80, label: "Early Blight", conf: 87, color: "#ef4444" },
        { x: 85, y: 105, w: 80, h: 70, label: "Healthy Leaf", conf: 96, color: "#22c55e" },
        { x: 160, y: 148, w: 80, h: 60, label: "Healthy Leaf", conf: 92, color: "#22c55e" },
      ];

      boxes.forEach(({ x, y, w, h, label, conf, color }) => {
        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        const dashOffset = (t * 30) % 20;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -dashOffset;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Corner marks
        const cs = 10;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy], i) => {
          ctx.beginPath();
          ctx.moveTo(cx + (i%2===0?0:-(cs)), cy);
          ctx.lineTo(cx + (i%2===0?cs:0), cy);
          ctx.moveTo(cx, cy + (i<2?0:-(cs)));
          ctx.lineTo(cx, cy + (i<2?cs:0));
          ctx.stroke();
        });

        // Label
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 20, label.length * 6.5 + conf.toString().length * 5 + 28, 18);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillText(`${label} ${conf}%`, x + 6, y - 7);
      });

      // Scan line
      const scanY = ((t * 60) % canvas.height);
      const scanGrad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
      scanGrad.addColorStop(0, "transparent");
      scanGrad.addColorStop(0.5, "rgba(47,158,68,0.4)");
      scanGrad.addColorStop(1, "transparent");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 8, canvas.width, 16);

      // Corner overlay (HUD style)
      ctx.strokeStyle = "rgba(47,158,68,0.4)";
      ctx.lineWidth = 2;
      const cs = 20;
      [[0,0],[canvas.width,0],[0,canvas.height],[canvas.width,canvas.height]].forEach(([cx,cy],i) => {
        const sx = i%2===0?cs:-cs, sy = i<2?cs:-cs;
        ctx.beginPath();
        ctx.moveTo(cx+sx,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+sy);
        ctx.stroke();
      });

      // Status text
      ctx.fillStyle = "rgba(47,158,68,0.8)";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText(`LIVE • ${new Date().toLocaleTimeString()} • FPS:30`, 12, canvas.height - 10);
      ctx.fillText("AI VISION ACTIVE", canvas.width - 120, canvas.height - 10);

      setFrame(f => f + 1);
      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={470}
      height={320}
      className="w-full h-full object-cover rounded-[20px]"
      style={{ display: "block" }}
    />
  );
}

export default function AIDetectionPage() {
  useRealtimeData();
  const { detections } = useAgriStore();

  const totalToday = detections.length + 47;
  const healthy = detections.filter(d => d.label === "Healthy Leaf").length;
  const diseases = detections.filter(d => d.label !== "Healthy Leaf").length;
  const avgConf = Math.round(detections.reduce((a, d) => a + d.confidence, 0) / (detections.length || 1));

  return (
    <div className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto pt-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>AI Detection</h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
          Live Computer Vision · Early Blight & Disease Detection
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
                <span className="text-green-300 text-sm font-semibold">Live Camera Feed — Camera A1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                  ● REC
                </span>
                <Camera className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <div style={{ height: 320 }}>
              <LiveCameraFeed />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Detections", value: totalToday, suffix: "", icon: Eye, color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
              { label: "Avg Confidence", value: avgConf, suffix: "%", icon: Zap, color: "#f4c542", bg: "rgba(244,197,66,0.1)" },
              { label: "Healthy Leaves", value: healthy, suffix: "", icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
              { label: "Disease Found", value: diseases, suffix: "", icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
            ].map(({ label, value, suffix, icon: Icon, color, bg }) => (
              <motion.div
                key={label}
                whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(47,158,68,0.12)" }}
                className="rounded-[20px] p-4"
                style={{ background: "#f7faf8", border: "1px solid #d9e5dc" }}
              >
                <div className="w-9 h-9 rounded-[12px] flex items-center justify-center mb-3" style={{ background: bg }}>
                  <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: "#1e2b22" }}>
                  {value}{suffix}
                </div>
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

          <div className="flex-1 overflow-y-auto divide-y" style={{ divideColor: "#eef3ef", maxHeight: 560 }}>
            <AnimatePresence initial={false}>
              {detections.map((d) => {
                const c = labelColors[d.label] || labelColors["Healthy Leaf"];
                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    {/* Color thumbnail */}
                    <div className="w-10 h-10 rounded-[12px] flex-shrink-0 flex items-center justify-center"
                      style={{ background: c.bg, border: `2px solid ${c.border}` }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: d.imageColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate" style={{ color: "#1e2b22" }}>
                          {d.label}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: c.bg, color: c.text }}>
                          {d.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Camera className="w-3 h-3 flex-shrink-0" style={{ color: "#6b7c72" }} />
                        <span className="text-xs truncate" style={{ color: "#6b7c72" }}>{d.cameraSource}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" style={{ color: "#9bb8a4" }} />
                      <span className="text-[10px]" style={{ color: "#9bb8a4" }}>
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
