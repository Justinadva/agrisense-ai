"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAgriStore } from "@/lib/store";
import type { MqttSensorData } from "@/lib/websocket";
import type { ChartPoint, AlertData, LogEntry } from "@/lib/mockData";

// ─── Supabase row shape (matches public.sensor_logs) ─────────────────────────
interface SensorLogRow {
  id: number;
  temperature: number;
  humidity: number;
  soil_moisture: number;   // already converted to % by the bridge
  soil_raw_adc: number;
  pump_status: boolean;
  mqtt_topic: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveDisease(moisture: number): string {
  if (moisture < 30) return "Moisture Stress";
  return "Healthy";
}

function rowToSensorData(row: SensorLogRow): MqttSensorData {
  return {
    soilMoisture: row.soil_moisture,
    temperature: row.temperature,
    humidity: row.humidity,
    aiConfidence: 90 + Math.round(Math.random() * 8),
    disease: deriveDisease(row.soil_moisture),
    waterFlow: row.pump_status ? parseFloat((1.5 + Math.random() * 3).toFixed(1)) : 0,
    tankCapacity: 70,
    phLevel: parseFloat((6.2 + Math.random() * 0.8).toFixed(1)),
    pumpActive: row.pump_status,
    timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function rowToChartPoint(row: SensorLogRow): ChartPoint {
  const t = row.created_at ? new Date(row.created_at) : new Date();
  return {
    time: `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`,
    moisture: row.soil_moisture,
    pump: row.pump_status ? 80 : 0,
    confidence: 90 + Math.round(Math.random() * 8),
    temperature: row.temperature,
    healthScore: row.soil_moisture > 50 ? 90 : row.soil_moisture > 30 ? 65 : 40,
  };
}

function rowToLogEntry(row: SensorLogRow): LogEntry {
  return {
    id: `${row.id}-${Date.now()}`,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString("en-US", { hour12: false })
      : new Date().toLocaleTimeString("en-US", { hour12: false }),
    sensor: "ESP8266",
    event: row.pump_status ? "Pump ON — Auto irrigation" : "Sensor reading received",
    status: row.soil_moisture < 30 ? "warning" : "info",
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
 * Subscribes to Supabase Realtime INSERT events on public.sensor_logs.
 * Maps each new row into the Zustand store (sensor data, chart, logs, alerts).
 * Call once in a top-level component (e.g. each page layout).
 */
export function useRealtimeData(): void {
  const { updateSensorData, addChartPoint, addLog, addAlert, setMqttStatus } =
    useAgriStore();

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
      setMqttStatus("error");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    setMqttStatus("connecting");

    const channel = supabase
      .channel("sensor_logs_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_logs" },
        (payload) => {
          const row = payload.new as SensorLogRow;

          // Push to Zustand
          updateSensorData(rowToSensorData(row));
          addChartPoint(rowToChartPoint(row));
          addLog(rowToLogEntry(row));

          const alert = rowToAlert(row);
          if (alert) addAlert(alert);

          setMqttStatus("connected");
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.info("[Supabase] ✓ Realtime subscribed to sensor_logs");
          setMqttStatus("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[Supabase] Realtime subscription error:", status);
          setMqttStatus("error");
        } else if (status === "CLOSED") {
          setMqttStatus("disconnected");
        }
      });

    // Cleanup: unsubscribe when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateSensorData, addChartPoint, addLog, addAlert, setMqttStatus]);
}
