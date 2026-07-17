"use client";

import { useEffect, useRef } from "react";
import { useAgriStore } from "@/lib/store";
import type { MqttSensorData } from "@/lib/websocket";
import type { ChartPoint, AlertData, LogEntry } from "@/lib/mockData";
import type { SensorLogRow } from "@/app/api/sensor-logs/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
// NOTE: Neon table has 5 columns: id, temperature, humidity, soil_moisture, created_at
// Fields not in DB (pump_status, soil_raw_adc) are derived or defaulted below.

function deriveDisease(moisture: number): string {
  if (moisture < 30) return "Moisture Stress";
  return "Healthy";
}

function rowToSensorData(row: SensorLogRow): MqttSensorData {
  return {
    soilMoisture: row.soil_moisture,
    temperature:  row.temperature,
    humidity:     row.humidity,
    aiConfidence: 90 + Math.round(Math.random() * 8),
    disease:      deriveDisease(row.soil_moisture),
    waterFlow:    0,   // not available in current schema
    tankCapacity: 70,
    phLevel:      parseFloat((6.2 + Math.random() * 0.8).toFixed(1)),
    pumpActive:   false, // not available in current schema
    timestamp:    row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function rowToChartPoint(row: SensorLogRow): ChartPoint {
  const t = row.created_at ? new Date(row.created_at) : new Date();
  return {
    time:        `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`,
    moisture:    row.soil_moisture,
    pump:        0,   // not available in current schema
    confidence:  90 + Math.round(Math.random() * 8),
    temperature: row.temperature,
    healthScore: row.soil_moisture > 50 ? 90 : row.soil_moisture > 30 ? 65 : 40,
  };
}

function rowToLogEntry(row: SensorLogRow): LogEntry {
  return {
    id:       `${row.id}-${Date.now()}`,
    time:     row.created_at
      ? new Date(row.created_at).toLocaleTimeString("en-US", { hour12: false })
      : new Date().toLocaleTimeString("en-US", { hour12: false }),
    sensor:   "ESP8266",
    event:    "Sensor reading received",
    status:   row.soil_moisture < 30 ? "warning" : "info",
    aiResult: `Soil ${row.soil_moisture}% | T:${row.temperature}°C | H:${row.humidity}%`,
  };
}

function rowToAlert(row: SensorLogRow): AlertData | null {
  if (row.soil_moisture < 30) {
    return {
      id:          `alert-${row.id}-${Date.now()}`,
      type:        "error",
      title:       "Critical Moisture Level",
      description: `Soil moisture at ${row.soil_moisture}% — immediate irrigation required`,
      timestamp:   new Date(),
      severity:    "high",
      resolved:    false,
    };
  }
  if (row.soil_moisture < 50) {
    return {
      id:          `alert-${row.id}-${Date.now()}`,
      type:        "warning",
      title:       "Low Soil Moisture",
      description: `Soil moisture at ${row.soil_moisture}% — below optimal threshold`,
      timestamp:   new Date(),
      severity:    "medium",
      resolved:    false,
    };
  }
  if (row.temperature > 35) {
    return {
      id:          `alert-${row.id}-${Date.now()}`,
      type:        "warning",
      title:       "High Temperature",
      description: `Temperature at ${row.temperature}°C — heat stress risk`,
      timestamp:   new Date(),
      severity:    "medium",
      resolved:    false,
    };
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches sensor data from Neon PostgreSQL via the /api/sensor-logs API Route.
 *
 * Strategy:
 *   1. On mount — fetches the latest 48 rows to populate chart history
 *   2. Every 10 s — polls for the latest single row (replaces Supabase Realtime)
 *      and skips processing if the row id was already handled
 */
export function useRealtimeData(): void {
  const { updateSensorData, addChartPoint, addLog, addAlert, setMqttStatus, updateContainerFromSensor } =
    useAgriStore();

  /** Tracks the highest row id already dispatched to the store. */
  const lastProcessedId = useRef<number>(-1);

  useEffect(() => {
    setMqttStatus("connecting");

    // ── Helper: process one new row ────────────────────────────────────────────
    const processRow = (row: SensorLogRow) => {
      if (row.id <= lastProcessedId.current) return; // already handled
      lastProcessedId.current = row.id;

      updateSensorData(rowToSensorData(row));
      addChartPoint(rowToChartPoint(row));
      addLog(rowToLogEntry(row));
      const alert = rowToAlert(row);
      if (alert) addAlert(alert);
      updateContainerFromSensor(rowToSensorData(row));
      setMqttStatus("connected");
    };

    // ── 1. Load latest 48 rows on mount (chart history) ───────────────────────
    const loadInitialData = async () => {
      try {
        const res = await fetch("/api/sensor-logs?limit=48");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as { rows: SensorLogRow[] };
        const rows = json.rows ?? [];

        if (rows.length === 0) {
          console.info("[Neon] No rows yet in sensor_logs");
          setMqttStatus("connected");
          return;
        }

        // Rows are already ascending (oldest → newest) from the API
        rows.forEach((row) => {
          addChartPoint(rowToChartPoint(row));
          if (row.id > lastProcessedId.current) {
            lastProcessedId.current = row.id;
          }
        });

        // Set live sensor state from the most recent row
        const latest = rows[rows.length - 1];
        const latestSensorData = rowToSensorData(latest);
        updateSensorData(latestSensorData);
        addLog(rowToLogEntry(latest));
        updateContainerFromSensor(latestSensorData);
        const alert = rowToAlert(latest);
        if (alert) addAlert(alert);

        setMqttStatus("connected");
        console.info(
          `[Neon] ✓ Loaded ${rows.length} historical rows (last id: ${lastProcessedId.current})`,
        );
      } catch (err) {
        console.error("[Neon] Initial fetch error:", err);
        setMqttStatus("error");
      }
    };

    loadInitialData();

    // ── 2. Polling every 10 s — replaces Supabase Realtime ────────────────────
    const pollLatestRow = async () => {
      try {
        const res = await fetch("/api/sensor-logs?latest=1");
        if (!res.ok) return;

        const json = (await res.json()) as { row: SensorLogRow | null };
        if (!json.row) return;

        const row = json.row;
        if (row.id > lastProcessedId.current) {
          console.info("[Neon][Poll] New row detected via polling:", row.id);
          processRow(row);
        }
      } catch (err) {
        console.warn("[Neon][Poll] Unexpected error:", err);
      }
    };

    const pollInterval = setInterval(pollLatestRow, 10_000);

    // ── 3. Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      clearInterval(pollInterval);
    };
    }, [updateSensorData, addChartPoint, addLog, addAlert, setMqttStatus, updateContainerFromSensor]);
}
