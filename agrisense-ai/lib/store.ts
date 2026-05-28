// lib/store.ts — Zustand global store for IoT state management
import { create } from "zustand";
import {
  SensorData,
  ContainerData,
  AlertData,
  ChartPoint,
  LogEntry,
  DetectionResult,
  generateSensorData,
  initialContainers,
  initialAlerts,
  generateChartHistory,
  initialLogs,
  initialDetections,
} from "./mockData";

interface AgriStore {
  // Sensor state
  sensorData: SensorData;
  containers: ContainerData[];
  alerts: AlertData[];
  chartHistory: ChartPoint[];
  logs: LogEntry[];
  detections: DetectionResult[];

  // Pump control
  pumpActive: boolean;
  pumpAutoMode: boolean;
  moistureThreshold: number;

  // Actions
  updateSensorData: (data: SensorData) => void;
  updateContainers: (containers: ContainerData[]) => void;
  addAlert: (alert: AlertData) => void;
  addChartPoint: (point: ChartPoint) => void;
  addLog: (log: LogEntry) => void;
  addDetection: (detection: DetectionResult) => void;
  togglePump: () => void;
  toggleAutoMode: () => void;
  setMoistureThreshold: (val: number) => void;
  clearLogs: () => void;
  resolveAlert: (id: string) => void;
}

export const useAgriStore = create<AgriStore>((set, get) => ({
  sensorData: generateSensorData(),
  containers: initialContainers,
  alerts: initialAlerts,
  chartHistory: generateChartHistory(),
  logs: initialLogs,
  detections: initialDetections,
  pumpActive: false,
  pumpAutoMode: true,
  moistureThreshold: 50,

  updateSensorData: (data) => set({ sensorData: data }),

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

  togglePump: () =>
    set((state) => {
      const next = !state.pumpActive;
      const log: LogEntry = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        sensor: "Pump",
        event: next ? "Pump Activated (Manual)" : "Pump Deactivated",
        status: next ? "success" : "info",
        aiResult: "Manual",
      };
      return { pumpActive: next, logs: [log, ...state.logs].slice(0, 200) };
    }),

  toggleAutoMode: () =>
    set((state) => ({ pumpAutoMode: !state.pumpAutoMode })),

  setMoistureThreshold: (val) => set({ moistureThreshold: val }),

  clearLogs: () => set({ logs: [] }),

  resolveAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
    })),
}));
