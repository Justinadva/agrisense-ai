"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAgriStore } from "@/lib/store";
import type { MqttSensorData } from "@/lib/websocket";
import type { ChartPoint, AlertData, LogEntry } from "@/lib/mockData";

// ─── Supabase row shape (matches public.sensor_logs) ─────────────────────────
interface SensorLogRow {
  id: number;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  soil_raw_adc: number;
  pump_status: boolean;
  mqtt_topic: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveDisease(moisture: number): string {
  if (moisture < 30) return "Moisture Stress";
  return "Healthy";
}

function rowToSensorData(row: SensorLogRow): MqttSensorData {
  return {
    soilMoisture:  row.soil_moisture,
    temperature:   row.temperature,
    humidity:      row.humidity,
    aiConfidence:  90 + Math.round(Math.random() * 8),
    disease:       deriveDisease(row.soil_moisture),
    waterFlow:     row.pump_status ? parseFloat((1.5 + Math.random() * 3).toFixed(1)) : 0,
    tankCapacity:  70,
    phLevel:       parseFloat((6.2 + Math.random() * 0.8).toFixed(1)),
    pumpActive:    row.pump_status,
    timestamp:     row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function rowToChartPoint(row: SensorLogRow): ChartPoint {
  const t = row.created_at ? new Date(row.created_at) : new Date();
  return {
    time:        `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`,
    moisture:    row.soil_moisture,
    pump:        row.pump_status ? 80 : 0,
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
    event:    row.pump_status ? "Pump ON — Auto irrigation" : "Sensor reading received",
    status:   row.soil_moisture < 30 ? "warning" : "info",
    aiResult: `Soil ${row.soil_moisture}% | T:${row.temperature}°C | H:${row.humidity}%`,
  };
}

function rowToAlert(row: SensorLogRow): AlertData | null {
  if (row.soil_moisture < 30) {
    return {
      id: `alert-${row.id}-${Date.now()}`,
      type: "error",
      title: "Critical Moisture Level",
      description: `Soil moisture at ${row.soil_moisture}% — immediate irrigation required`,
      timestamp: new Date(),
      severity: "high",
      resolved: false,
    };
  }
  if (row.soil_moisture < 50) {
    return {
      id: `alert-${row.id}-${Date.now()}`,
      type: "warning",
      title: "Low Soil Moisture",
      description: `Soil moisture at ${row.soil_moisture}% — below optimal threshold`,
      timestamp: new Date(),
      severity: "medium",
      resolved: false,
    };
  }
  if (row.temperature > 35) {
    return {
      id: `alert-${row.id}-${Date.now()}`,
      type: "warning",
      title: "High Temperature",
      description: `Temperature at ${row.temperature}°C — heat stress risk`,
      timestamp: new Date(),
      severity: "medium",
      resolved: false,
    };
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * 1. Fetches the latest 48 rows from sensor_logs on mount (fills chart history)
 * 2. Subscribes to Realtime INSERT events for live updates (fast path)
 * 3. Polls sensor_logs every 10 seconds for the latest row (fallback path)
 *    — skips processing if the row id has already been handled by Realtime
 * 4. Cleans up the channel and interval on unmount
 */
export function useRealtimeData(): void {
  const { updateSensorData, addChartPoint, addLog, addAlert, setMqttStatus } =
    useAgriStore();

  /** Tracks the highest row id already dispatched to the store. */
  const lastProcessedId = useRef<number>(-1);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch (e) {
      console.error("[Supabase] Failed to initialise client:", e);
      setMqttStatus("error");
      return;
    }

    setMqttStatus("connecting");

    // ── Helper: process a single new row ────────────────────────────────────
    const processRow = (row: SensorLogRow) => {
      if (row.id <= lastProcessedId.current) return; // already handled
      lastProcessedId.current = row.id;

      updateSensorData(rowToSensorData(row));
      addChartPoint(rowToChartPoint(row));
      addLog(rowToLogEntry(row));
      const alert = rowToAlert(row);
      if (alert) addAlert(alert);
      setMqttStatus("connected");
    };

    // ── 1. Load latest 48 rows on mount (chronological chart history) ────────
    const loadInitialData = async () => {
      const { data, error } = await supabase
        .from("sensor_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(48);

      if (error) {
        console.error("[Supabase] Initial fetch error:", error.message);
        return;
      }

      if (!data || data.length === 0) {
        console.info("[Supabase] No rows yet in sensor_logs");
        return;
      }

      // Rows come newest-first → reverse so chart renders chronologically
      const rows = [...(data as SensorLogRow[])].reverse();

      // Push chart history (all rows) — bypass duplicate check for history load
      rows.forEach((row) => {
        addChartPoint(rowToChartPoint(row));
        // Track the highest id so polling doesn't reprocess these rows
        if (row.id > lastProcessedId.current) {
          lastProcessedId.current = row.id;
        }
      });

      // Set current sensor reading from the most recent row
      const latest = data[0] as SensorLogRow;
      updateSensorData(rowToSensorData(latest));
      addLog(rowToLogEntry(latest));

      const alert = rowToAlert(latest);
      if (alert) addAlert(alert);

      console.info(`[Supabase] ✓ Loaded ${rows.length} historical rows (last id: ${lastProcessedId.current})`);
    };

    loadInitialData();

    // ── 2. Subscribe to Realtime INSERTs (fast path) ─────────────────────────
    const channel = supabase
      .channel("sensor_logs_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_logs" },
        (payload) => {
          const row = payload.new as SensorLogRow;
          console.info("[Supabase][Realtime] New row:", row.id);
          processRow(row);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[Supabase] ✓ Realtime subscribed to sensor_logs");
          setMqttStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `[Supabase] Realtime ${status} — polling fallback is active`
          );
          // Don't flip to error: polling will keep data flowing
        } else if (status === "CLOSED") {
          setMqttStatus("disconnected");
        }
      });

    // ── 3. Polling fallback — fetch latest row every 10 seconds ──────────────
    const pollLatestRow = async () => {
      try {
        const { data, error } = await supabase
          .from("sensor_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          // PGRST116 = no rows; treat as non-fatal
          if (error.code !== "PGRST116") {
            console.warn("[Supabase][Poll] Query error:", error.message);
          }
          return;
        }

        if (!data) return;

        const row = data as SensorLogRow;
        if (row.id > lastProcessedId.current) {
          console.info("[Supabase][Poll] New row detected via polling:", row.id);
          processRow(row);
        }
      } catch (err) {
        console.warn("[Supabase][Poll] Unexpected error:", err);
      }
    };

    const pollInterval = setInterval(pollLatestRow, 10_000);

    // ── 4. Cleanup ────────────────────────────────────────────────────────────
    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [updateSensorData, addChartPoint, addLog, addAlert, setMqttStatus]);
}
