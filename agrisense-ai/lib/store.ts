// lib/store.ts — Zustand global store for IoT state management
import { create } from "zustand";
import type { MqttStatus, MqttSensorData } from "./websocket";
import type {
  ContainerData,
  AlertData,
  ChartPoint,
  LogEntry,
  DetectionResult,
} from "./mockData";
import {
  initialContainers,
  initialAlerts,
  initialLogs,
  initialDetections,
} from "./mockData";

// Re-export the sensor type used throughout the app
// We use SensorData from mockData as the base shape, MqttSensorData extends it
export type { MqttSensorData as LiveSensorData };

// Shape for sensor state — mirrors MqttSensorData from websocket.ts
export type SensorSnapshot = {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  aiConfidence: number;
  disease: string;
  waterFlow: number;
  tankCapacity: number;
  phLevel: number;
  pumpActive: boolean;
  timestamp: number;
};

interface AgriStore {
  // ── Sensor state ────────────────────────────────────────────────────────────
  sensorData: SensorSnapshot;
  containers: ContainerData[];
  alerts: AlertData[];
  chartHistory: ChartPoint[];
  logs: LogEntry[];
  detections: DetectionResult[];

  // ── MQTT / connection ────────────────────────────────────────────────────────
  mqttStatus: MqttStatus;
  pumpActive: boolean;
  pumpAutoMode: boolean;
  moistureThreshold: number;

  // ── Actions ──────────────────────────────────────────────────────────────────
  updateSensorData: (data: MqttSensorData) => void;
  updateContainers: (containers: ContainerData[]) => void;
  addAlert: (alert: AlertData) => void;
  addChartPoint: (point: ChartPoint) => void;
  addLog: (log: LogEntry) => void;
  addDetection: (detection: DetectionResult) => void;
  setMqttStatus: (status: MqttStatus) => void;
  togglePump: () => void;
  toggleAutoMode: () => void;
  setMoistureThreshold: (val: number) => void;
  clearLogs: () => void;
  resolveAlert: (id: string) => void;
}

// ── Zero-value initial sensor state — real data flows in from Supabase ────────
const initialSensorData: SensorSnapshot = {
  soilMoisture: 0,
  temperature: 0,
  humidity: 0,
  aiConfidence: 0,
  disease: "—",
  waterFlow: 0,
  tankCapacity: 0,
  phLevel: 0,
  pumpActive: false,
  timestamp: 0,
};

export const useAgriStore = create<AgriStore>((set, _get) => ({
  sensorData: initialSensorData,
  containers: initialContainers,
  alerts: initialAlerts,
  chartHistory: [],          // starts empty — populated by Supabase realtime
  logs: initialLogs,
  detections: initialDetections,
  mqttStatus: "disconnected",
  pumpActive: false,
  pumpAutoMode: true,
  moistureThreshold: 50,

  // ── Live MQTT sensor update ──────────────────────────────────────────────────
  updateSensorData: (data: MqttSensorData) =>
    set({
      sensorData: data,
      // Sync pump state from ESP8266 report when in auto mode
      pumpActive: data.pumpActive,
    }),

  updateContainers: (containers) => set({ containers }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 50),
    })),

  addChartPoint: (point) =>
    set((state) => ({
      chartHistory: [...state.chartHistory.slice(-47), point],
    })),

  addLog: (log) =>
    set((state) => ({
      logs: [log, ...state.logs].slice(0, 200),
    })),

  addDetection: (detection) =>
    set((state) => ({
      detections: [detection, ...state.detections].slice(0, 50),
    })),

  setMqttStatus: (status) => set({ mqttStatus: status }),

  // ── Manual pump toggle (overrides auto until next MQTT message) ──────────────
  togglePump: () =>
    set((state) => {
      const next = !state.pumpActive;
      const log: LogEntry = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        sensor: "Pump",
        event: next ? "Pump Activated (Manual)" : "Pump Deactivated (Manual)",
        status: next ? "success" : "info",
        aiResult: "Manual override",
      };
      return { pumpActive: next, logs: [log, ...state.logs].slice(0, 200) };
    }),

  toggleAutoMode: () => set((state) => ({ pumpAutoMode: !state.pumpAutoMode })),

  setMoistureThreshold: (val) => set({ moistureThreshold: val }),

  clearLogs: () => set({ logs: [] }),

  resolveAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, resolved: true } : a,
      ),
    })),
}));
