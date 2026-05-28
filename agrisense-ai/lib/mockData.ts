// lib/mockData.ts — Simulated IoT sensor data and AI detection results

export interface SensorData {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  aiConfidence: number;
  disease: string;
  waterFlow: number;
  tankCapacity: number;
  phLevel: number;
  timestamp: number;
}

export interface ContainerData {
  id: string;
  name: string;
  moisture: number;
  aiHealth: string;
  healthScore: number;
  temperature: number;
  status: "Optimal" | "Warning" | "Critical" | "Stable";
  lastScan: string;
}

export interface AlertData {
  id: string;
  type: "warning" | "error" | "success" | "info";
  title: string;
  description: string;
  timestamp: Date;
  severity: "low" | "medium" | "high";
  resolved: boolean;
}

export interface ChartPoint {
  time: string;
  moisture: number;
  pump: number;
  confidence: number;
  temperature: number;
  healthScore: number;
}

export interface LogEntry {
  id: string;
  time: string;
  sensor: string;
  event: string;
  status: "success" | "warning" | "error" | "info";
  aiResult?: string;
}

export interface DetectionResult {
  id: string;
  label: string;
  confidence: number;
  timestamp: Date;
  cameraSource: string;
  imageColor: string;
}

export const generateSensorData = (): SensorData => ({
  soilMoisture: Math.floor(65 + Math.random() * 20),
  temperature: Math.floor(24 + Math.random() * 8),
  humidity: Math.floor(60 + Math.random() * 20),
  aiConfidence: Math.floor(88 + Math.random() * 10),
  disease: Math.random() > 0.15 ? "Healthy" : "Early Blight",
  waterFlow: Math.floor(2 + Math.random() * 4),
  tankCapacity: Math.floor(65 + Math.random() * 20),
  phLevel: parseFloat((6.2 + Math.random() * 0.8).toFixed(1)),
  timestamp: Date.now(),
});

export const initialContainers: ContainerData[] = [
  { id: "1", name: "Tomato Bed #12", moisture: 82, aiHealth: "Healthy", healthScore: 96, temperature: 27, status: "Optimal", lastScan: "2 min ago" },
  { id: "2", name: "Tomato Bed #08", moisture: 41, aiHealth: "Early Blight Risk", healthScore: 58, temperature: 30, status: "Warning", lastScan: "5 min ago" },
  { id: "3", name: "Tomato Bed #05", moisture: 76, aiHealth: "Healthy", healthScore: 91, temperature: 26, status: "Stable", lastScan: "3 min ago" },
  { id: "4", name: "Tomato Bed #03", moisture: 68, aiHealth: "Healthy", healthScore: 87, temperature: 25, status: "Stable", lastScan: "7 min ago" },
  { id: "5", name: "Tomato Bed #15", moisture: 29, aiHealth: "Moisture Stress", healthScore: 44, temperature: 32, status: "Critical", lastScan: "1 min ago" },
  { id: "6", name: "Tomato Bed #09", moisture: 88, aiHealth: "Healthy", healthScore: 98, temperature: 26, status: "Optimal", lastScan: "4 min ago" },
];

export const initialAlerts: AlertData[] = [
  { id: "1", type: "warning", title: "Low Soil Moisture", description: "Tomato Bed #08 moisture at 41% — threshold 50%", timestamp: new Date(Date.now() - 120000), severity: "medium", resolved: false },
  { id: "2", type: "error", title: "Early Blight Detected", description: "AI detected Early Blight with 87% confidence on Bed #08", timestamp: new Date(Date.now() - 300000), severity: "high", resolved: false },
  { id: "3", type: "error", title: "Critical Moisture Level", description: "Tomato Bed #15 moisture at 29% — immediate irrigation needed", timestamp: new Date(Date.now() - 60000), severity: "high", resolved: false },
  { id: "4", type: "info", title: "AI Scan Complete", description: "All 6 containers scanned — 4 healthy, 1 warning, 1 critical", timestamp: new Date(Date.now() - 900000), severity: "low", resolved: true },
  { id: "5", type: "warning", title: "pH Abnormal", description: "Container #08 pH reading 7.4 — above optimal range", timestamp: new Date(Date.now() - 1800000), severity: "medium", resolved: false },
];

export const generateChartHistory = (): ChartPoint[] => {
  const points: ChartPoint[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 30 * 60 * 1000);
    const hour = t.getHours();
    const minute = t.getMinutes();
    points.push({
      time: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      moisture: Math.floor(55 + Math.sin(i * 0.4) * 18 + Math.random() * 6),
      pump: Math.random() > 0.7 ? Math.floor(40 + Math.random() * 60) : 0,
      confidence: Math.floor(82 + Math.sin(i * 0.3) * 10 + Math.random() * 5),
      temperature: Math.floor(25 + Math.sin(i * 0.2) * 4 + Math.random() * 2),
      healthScore: Math.floor(78 + Math.sin(i * 0.25) * 12 + Math.random() * 5),
    });
  }
  return points;
};

export const scheduledTasks = [
  { id: "1", title: "Watering System Adjustment", time: "10:30–11:00", status: "Scheduled" as const },
  { id: "2", title: "AI Disease Scan", time: "11:30–12:00", status: "Running" as const },
  { id: "3", title: "Nutrient Recommendation", time: "13:00–13:30", status: "Completed" as const },
  { id: "4", title: "Camera Monitoring", time: "14:00–14:30", status: "Scheduled" as const },
  { id: "5", title: "pH Balance Check", time: "15:00–15:30", status: "Scheduled" as const },
];

export const initialDetections: DetectionResult[] = [
  { id: "1", label: "Healthy Leaf", confidence: 96, timestamp: new Date(Date.now() - 30000), cameraSource: "Camera A1", imageColor: "#22c55e" },
  { id: "2", label: "Early Blight", confidence: 87, timestamp: new Date(Date.now() - 90000), cameraSource: "Camera B2", imageColor: "#ef4444" },
  { id: "3", label: "Leaf Spot", confidence: 73, timestamp: new Date(Date.now() - 180000), cameraSource: "Camera A1", imageColor: "#f59e0b" },
  { id: "4", label: "Healthy Leaf", confidence: 98, timestamp: new Date(Date.now() - 240000), cameraSource: "Camera C3", imageColor: "#22c55e" },
  { id: "5", label: "Moisture Stress", confidence: 81, timestamp: new Date(Date.now() - 360000), cameraSource: "Camera B2", imageColor: "#3b82f6" },
];

export const initialLogs: LogEntry[] = [
  { id: "1", time: "14:08:32", sensor: "Pump", event: "Pump Activated", status: "success", aiResult: "Auto-trigger" },
  { id: "2", time: "14:05:17", sensor: "Soil #08", event: "Moisture Below Threshold", status: "warning", aiResult: "41%" },
  { id: "3", time: "14:02:44", sensor: "AI Vision", event: "Early Blight Detected", status: "error", aiResult: "87% confidence" },
  { id: "4", time: "13:58:11", sensor: "Camera A1", event: "Camera Reconnected", status: "info", aiResult: "Online" },
  { id: "5", time: "13:52:03", sensor: "Soil #15", event: "Critical Moisture Level", status: "error", aiResult: "29%" },
  { id: "6", time: "13:45:29", sensor: "AI Vision", event: "Scan Complete", status: "success", aiResult: "6/6 containers" },
  { id: "7", time: "13:38:55", sensor: "Pump", event: "Pump Deactivated", status: "info", aiResult: "Cycle complete" },
  { id: "8", time: "13:30:12", sensor: "pH Sensor", event: "pH Abnormal", status: "warning", aiResult: "7.4 pH" },
];
