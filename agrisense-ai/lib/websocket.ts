// lib/websocket.ts — MQTT/WebSocket realtime data simulator
import { generateSensorData, ChartPoint, LogEntry, DetectionResult, AlertData } from "./mockData";

type Callback = (data: unknown) => void;

const diseaseLabels = ["Healthy Leaf", "Early Blight", "Leaf Spot", "Moisture Stress", "Healthy Leaf", "Healthy Leaf"];
const cameraSources = ["Camera A1", "Camera B2", "Camera C3"];
const labelColors: Record<string, string> = {
  "Healthy Leaf": "#22c55e",
  "Early Blight": "#ef4444",
  "Leaf Spot": "#f59e0b",
  "Moisture Stress": "#3b82f6",
};

class IoTSimulator {
  private listeners: Map<string, Callback[]> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private connected = false;

  connect() {
    if (this.connected) return;
    this.connected = true;

    // Sensor updates every 3s
    const sensorInterval = setInterval(() => {
      const data = generateSensorData();
      this.emit("sensor", data);

      // Chart point
      const now = new Date();
      const point: ChartPoint = {
        time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
        moisture: data.soilMoisture,
        pump: Math.random() > 0.6 ? Math.floor(30 + Math.random() * 70) : 0,
        confidence: data.aiConfidence,
        temperature: data.temperature,
        healthScore: Math.floor(data.aiConfidence * 0.95),
      };
      this.emit("chart", point);
    }, 3000);

    // AI detection events every 8s
    const detectionInterval = setInterval(() => {
      const label = diseaseLabels[Math.floor(Math.random() * diseaseLabels.length)];
      const detection: DetectionResult = {
        id: Date.now().toString(),
        label,
        confidence: Math.floor(72 + Math.random() * 27),
        timestamp: new Date(),
        cameraSource: cameraSources[Math.floor(Math.random() * cameraSources.length)],
        imageColor: labelColors[label] || "#22c55e",
      };
      this.emit("detection", detection);
    }, 8000);

    // Log events every 12s
    const logInterval = setInterval(() => {
      const events = [
        { sensor: "Soil Sensor", event: "Moisture Reading Updated", status: "info" as const },
        { sensor: "AI Vision", event: "Disease Scan Complete", status: "success" as const },
        { sensor: "Pump", event: "Water Flow Adjusted", status: "info" as const },
        { sensor: "Temp Sensor", event: "Temperature Alert", status: "warning" as const },
      ];
      const ev = events[Math.floor(Math.random() * events.length)];
      const log: LogEntry = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        ...ev,
        aiResult: "Auto",
      };
      this.emit("log", log);
    }, 12000);

    // Critical alerts randomly
    const alertInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        const alerts = [
          { type: "warning" as const, title: "Low Soil Moisture", description: "Moisture below threshold", severity: "medium" as const },
          { type: "error" as const, title: "Early Blight Risk", description: "AI detected potential disease", severity: "high" as const },
          { type: "success" as const, title: "Irrigation Complete", description: "Target moisture level reached", severity: "low" as const },
        ];
        const a = alerts[Math.floor(Math.random() * alerts.length)];
        const alert: AlertData = {
          id: Date.now().toString(),
          ...a,
          timestamp: new Date(),
          resolved: false,
        };
        this.emit("alert", alert);
      }
    }, 15000);

    this.intervals = [sensorInterval, detectionInterval, logInterval, alertInterval];
  }

  disconnect() {
    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.connected = false;
  }

  on(event: string, cb: Callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(cb);
  }

  off(event: string, cb: Callback) {
    const cbs = this.listeners.get(event) || [];
    this.listeners.set(event, cbs.filter((c) => c !== cb));
  }

  private emit(event: string, data: unknown) {
    (this.listeners.get(event) || []).forEach((cb) => cb(data));
  }
}

export const iotSimulator = new IoTSimulator();
export type { DetectionResult };
