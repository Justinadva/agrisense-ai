// lib/websocket.ts
// Real MQTT client over WebSocket connecting to HiveMQ public broker.
// Subscribes to "iot/tanaman/data" and re-emits parsed ESP8266 payloads
// so Zustand store and all chart/UI components update in real-time.
// Falls back to simulated data if MQTT is unavailable.

import type { MqttClient, IClientOptions } from "mqtt";
import type { ChartPoint, LogEntry, AlertData, DetectionResult } from "./mockData";

// ─── ESP8266 Payload ─────────────────────────────────────────────────────────
export interface Esp8266Payload {
  temperature: number;
  humidity: number;
  soil: number;
  pump: number;
}

// Mapped to our SensorData shape
export interface MqttSensorData {
  soilMoisture: number;   // mapped from soil (0-1023 ADC → 0-100%)
  temperature: number;
  humidity: number;
  aiConfidence: number;
  disease: string;
  waterFlow: number;
  tankCapacity: number;
  phLevel: number;
  pumpActive: boolean;    // derived from pump field (1 = on, 0 = off)
  timestamp: number;
}

// ─── Event Types ─────────────────────────────────────────────────────────────
type EventName = "sensor" | "chart" | "log" | "alert" | "status";
type Callback<T> = (data: T) => void;

type EventMap = {
  sensor: MqttSensorData;
  chart: ChartPoint;
  log: LogEntry;
  alert: AlertData;
  status: MqttStatus;
};

export type MqttStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "fallback";

// ─── Constants ───────────────────────────────────────────────────────────────
const MQTT_BROKER_URL = "ws://broker.hivemq.com:8000/mqtt";
const MQTT_TOPIC = "iot/tanaman/data";
const ADC_MAX = 1023; // ESP8266 ADC resolution
const RECONNECT_DELAY_MS = 5000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert ESP8266 ADC reading (0-1023) to soil moisture percentage (0-100).
 *  Dry soil → high ADC (inverted sensor). Adjust min/max per calibration. */
function adcToMoisturePercent(raw: number): number {
  const DRY_ADC = 1023;
  const WET_ADC = 0;
  const pct = ((DRY_ADC - raw) / (DRY_ADC - WET_ADC)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** Derive disease label from moisture + confidence heuristics. */
function deriveDiseaseLabel(moisture: number): string {
  if (moisture < 30) return "Moisture Stress";
  if (moisture < 50) return "Healthy";
  return "Healthy";
}

/** Map raw ESP8266 payload to internal SensorData shape. */
function mapPayload(raw: Esp8266Payload): MqttSensorData {
  const soilMoisture = adcToMoisturePercent(raw.soil);
  return {
    soilMoisture,
    temperature: raw.temperature,
    humidity: raw.humidity,
    aiConfidence: 90 + Math.round(Math.random() * 8), // AI not on ESP, keep heuristic
    disease: deriveDiseaseLabel(soilMoisture),
    waterFlow: raw.pump === 1 ? parseFloat((1.5 + Math.random() * 3).toFixed(1)) : 0,
    tankCapacity: 70, // not measured by ESP, static placeholder
    phLevel: parseFloat((6.2 + Math.random() * 0.8).toFixed(1)),
    pumpActive: raw.pump === 1,
    timestamp: Date.now(),
  };
}

/** Derive chart point from sensor data. */
function toChartPoint(sensor: MqttSensorData): ChartPoint {
  const now = new Date();
  return {
    time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
    moisture: sensor.soilMoisture,
    pump: sensor.pumpActive ? 80 : 0,
    confidence: sensor.aiConfidence,
    temperature: sensor.temperature,
    healthScore: Math.round(sensor.aiConfidence * 0.95),
  };
}

/** Derive log entry from sensor data. */
function toLogEntry(sensor: MqttSensorData): LogEntry {
  const pumpChanged = sensor.pumpActive;
  return {
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
    sensor: "ESP8266",
    event: pumpChanged ? "Pump ON — Auto irrigation" : "Sensor reading received",
    status: sensor.soilMoisture < 30 ? "warning" : "info",
    aiResult: `Soil ${sensor.soilMoisture}% | T:${sensor.temperature}°C | H:${sensor.humidity}%`,
  };
}

/** Generate alert if moisture or temperature is out of range. */
function maybeAlert(sensor: MqttSensorData): AlertData | null {
  if (sensor.soilMoisture < 30) {
    return {
      id: Date.now().toString(),
      type: "error",
      title: "Critical Moisture Level",
      description: `Soil moisture at ${sensor.soilMoisture}% — immediate irrigation required`,
      timestamp: new Date(),
      severity: "high",
      resolved: false,
    };
  }
  if (sensor.soilMoisture < 50) {
    return {
      id: Date.now().toString(),
      type: "warning",
      title: "Low Soil Moisture",
      description: `Soil moisture at ${sensor.soilMoisture}% — below optimal threshold`,
      timestamp: new Date(),
      severity: "medium",
      resolved: false,
    };
  }
  if (sensor.temperature > 35) {
    return {
      id: Date.now().toString(),
      type: "warning",
      title: "High Temperature",
      description: `Temperature at ${sensor.temperature}°C — heat stress risk`,
      timestamp: new Date(),
      severity: "medium",
      resolved: false,
    };
  }
  return null;
}

// ─── Fallback Simulator (if MQTT unreachable) ─────────────────────────────────
function generateFallbackPayload(): Esp8266Payload {
  return {
    temperature: parseFloat((24 + Math.random() * 8).toFixed(1)),
    humidity: parseFloat((60 + Math.random() * 20).toFixed(1)),
    soil: Math.floor(200 + Math.random() * 600),
    pump: Math.random() > 0.7 ? 1 : 0,
  };
}

// ─── IoT Simulator Class ──────────────────────────────────────────────────────
class IoTSimulator {
  private listeners: Map<EventName, Callback<EventMap[EventName]>[]> = new Map();
  private mqttClient: MqttClient | null = null;
  private fallbackInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private status: MqttStatus = "disconnected";
  private lastPumpState = false;

  // ── Public API ──────────────────────────────────────────────────────────────

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    this.initMqtt();
  }

  disconnect(): void {
    this.connected = false;
    this.mqttClient?.end(true);
    this.mqttClient = null;
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    this.setStatus("disconnected");
  }

  on<E extends EventName>(event: E, cb: Callback<EventMap[E]>): void {
    const existing = (this.listeners.get(event) ?? []) as Callback<EventMap[E]>[];
    existing.push(cb);
    this.listeners.set(event, existing as Callback<EventMap[EventName]>[]);
  }

  off<E extends EventName>(event: E, cb: Callback<EventMap[E]>): void {
    const existing = (this.listeners.get(event) ?? []) as Callback<EventMap[E]>[];
    this.listeners.set(
      event,
      existing.filter((c) => c !== cb) as Callback<EventMap[EventName]>[],
    );
  }

  getStatus(): MqttStatus {
    return this.status;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private setStatus(s: MqttStatus): void {
    this.status = s;
    this.emit("status", s);
  }

  private async initMqtt(): Promise<void> {
    // Dynamic import so the mqtt package loads only client-side (Next.js SSR safe)
    if (typeof window === "undefined") return;

    this.setStatus("connecting");

    try {
      const mqttModule = await import("mqtt");
      const mqtt = mqttModule.default ?? mqttModule;

      const options: IClientOptions = {
        clientId: `agrisense_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: RECONNECT_DELAY_MS,
        connectTimeout: 10_000,
        keepalive: 60,
      };

      this.mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

      this.mqttClient.on("connect", () => {
        this.setStatus("connected");
        this.stopFallback();
        this.mqttClient!.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
          if (err) {
            console.error("[MQTT] Subscribe error:", err.message);
          } else {
            console.info(`[MQTT] Subscribed to ${MQTT_TOPIC}`);
          }
        });
      });

      this.mqttClient.on("message", (_topic: string, payload: Buffer) => {
        this.handleMessage(payload.toString());
      });

      this.mqttClient.on("error", (err: Error) => {
        console.error("[MQTT] Connection error:", err.message);
        this.setStatus("error");
        this.startFallback();
      });

      this.mqttClient.on("offline", () => {
        this.setStatus("disconnected");
        this.startFallback();
      });

      this.mqttClient.on("reconnect", () => {
        this.setStatus("connecting");
      });

      // If not connected within 12 s, start fallback
      setTimeout(() => {
        if (this.status === "connecting") {
          console.warn("[MQTT] Connection timeout — starting fallback simulator");
          this.startFallback();
        }
      }, 12_000);

    } catch (err) {
      console.error("[MQTT] Module load error:", err);
      this.setStatus("fallback");
      this.startFallback();
    }
  }

  private handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw) as Esp8266Payload;

      // Validate shape
      if (
        typeof payload.temperature !== "number" ||
        typeof payload.humidity !== "number" ||
        typeof payload.soil !== "number" ||
        typeof payload.pump !== "number"
      ) {
        console.warn("[MQTT] Unexpected payload shape:", payload);
        return;
      }

      this.processPayload(payload);
    } catch {
      console.warn("[MQTT] Failed to parse message:", raw);
    }
  }

  private processPayload(payload: Esp8266Payload): void {
    const sensor = mapPayload(payload);

    // Emit sensor update
    this.emit("sensor", sensor);
    this.emit("chart", toChartPoint(sensor));

    // Emit log every message
    this.emit("log", toLogEntry(sensor));

    // Pump state change → emit log
    if (sensor.pumpActive !== this.lastPumpState) {
      this.lastPumpState = sensor.pumpActive;
      const pumpLog: LogEntry = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        sensor: "Pump",
        event: sensor.pumpActive ? "Pump Activated — ESP8266 trigger" : "Pump Deactivated",
        status: sensor.pumpActive ? "success" : "info",
        aiResult: "MQTT",
      };
      this.emit("log", pumpLog);
    }

    // Conditional alert
    const alert = maybeAlert(sensor);
    if (alert) this.emit("alert", alert);
  }

  // ── Fallback ────────────────────────────────────────────────────────────────

  private startFallback(): void {
    if (this.fallbackInterval) return;
    this.setStatus("fallback");
    console.info("[IoT] Fallback simulator active (3s interval)");

    this.fallbackInterval = setInterval(() => {
      const payload = generateFallbackPayload();
      this.processPayload(payload);
    }, 3000);
  }

  private stopFallback(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  // ── Emit helper (typed) ─────────────────────────────────────────────────────

  private emit<E extends EventName>(event: E, data: EventMap[E]): void {
    const cbs = (this.listeners.get(event) ?? []) as Callback<EventMap[E]>[];
    cbs.forEach((cb) => cb(data));
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────
export const iotSimulator = new IoTSimulator();
