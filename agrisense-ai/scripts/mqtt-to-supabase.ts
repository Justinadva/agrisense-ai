#!/usr/bin/env node
/**
 * scripts/mqtt-to-neon.ts  (formerly mqtt-to-supabase.ts)
 *
 * MQTT → Neon PostgreSQL bridge.
 * Run with: npm run bridge
 *
 * Environment variables (set in .env or shell):
 *   DATABASE_URL    — Neon connection string (postgresql://...)
 *   MQTT_BROKER_URL — default: ws://broker.hivemq.com:8000/mqtt
 *   MQTT_TOPIC      — default: iot/tanaman/data
 */

import * as dotenv from "dotenv";
dotenv.config();

import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ─── Environment ──────────────────────────────────────────────────────────────

const DATABASE_URL: string   = process.env.DATABASE_URL ?? "";
const MQTT_BROKER_URL: string =
  process.env.MQTT_BROKER_URL ?? "ws://broker.hivemq.com:8000/mqtt";
const MQTT_TOPIC: string = process.env.MQTT_TOPIC ?? "iot/tanaman/data";

if (!DATABASE_URL) {
  console.error(
    "[bridge] ERROR: DATABASE_URL must be set in your .env file.\n" +
    "  Example:\n" +
    "    DATABASE_URL=postgresql://user:pass@host/db?sslmode=require\n",
  );
  process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw payload from ESP8266 */
interface Esp8266Payload {
  temperature: number;
  humidity:    number;
  soil:        number; // ADC value 0–1023
  pump:        number; // 0 = off, 1 = on
}

/** Row shape matching public.sensor_logs */
interface SensorLogRow {
  temperature:   number;
  humidity:      number;
  soil_moisture: number;
  soil_raw_adc:  number;
  pump_status:   boolean;
  mqtt_topic:    string;
}

/** Row shape for public.alert_logs */
interface AlertLogRow {
  severity:      "low" | "medium" | "high";
  alert_type:    "warning" | "error" | "info" | "success";
  title:         string;
  description:   string;
  sensor_log_id: number | null;
}

// ─── ADC conversion ───────────────────────────────────────────────────────────

/** Convert ESP8266 ADC (0–1023) to soil moisture percentage (0–100).
 *  Assumes inverted resistive soil sensor (dry = high ADC). */
function adcToMoisturePercent(adc: number): number {
  const DRY_ADC = 1023;
  const WET_ADC = 0;
  return Math.min(
    100,
    Math.max(0, Math.round(((DRY_ADC - adc) / (DRY_ADC - WET_ADC)) * 100)),
  );
}

// ─── Payload validation ───────────────────────────────────────────────────────

function isValidPayload(value: unknown): value is Esp8266Payload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.temperature === "number" &&
    typeof obj.humidity    === "number" &&
    typeof obj.soil        === "number" &&
    typeof obj.pump        === "number"
  );
}

// ─── Threshold alerts ─────────────────────────────────────────────────────────

function buildAlerts(row: SensorLogRow, sensorLogId: number): AlertLogRow[] {
  const alerts: AlertLogRow[] = [];

  if (row.soil_moisture < 30) {
    alerts.push({
      severity:      "high",
      alert_type:    "error",
      title:         "Critical Moisture Level",
      description:   `Soil moisture at ${row.soil_moisture}% — immediate irrigation required`,
      sensor_log_id: sensorLogId,
    });
  } else if (row.soil_moisture < 50) {
    alerts.push({
      severity:      "medium",
      alert_type:    "warning",
      title:         "Low Soil Moisture",
      description:   `Soil moisture at ${row.soil_moisture}% — below optimal threshold`,
      sensor_log_id: sensorLogId,
    });
  }

  if (row.temperature > 35) {
    alerts.push({
      severity:      "medium",
      alert_type:    "warning",
      title:         "High Temperature",
      description:   `Temperature at ${row.temperature}°C — heat stress risk for tomato plants`,
      sensor_log_id: sensorLogId,
    });
  }

  if (row.humidity > 90) {
    alerts.push({
      severity:      "low",
      alert_type:    "info",
      title:         "High Humidity",
      description:   `Humidity at ${row.humidity}% — increased fungal disease risk`,
      sensor_log_id: sensorLogId,
    });
  }

  return alerts;
}

// ─── Neon INSERT helpers ──────────────────────────────────────────────────────

async function insertSensorLog(
  db: NeonQueryFunction<false, false>,
  row: SensorLogRow,
): Promise<number | null> {
  try {
    const result = await db`
      INSERT INTO sensor_logs
        (temperature, humidity, soil_moisture, soil_raw_adc, pump_status, mqtt_topic)
      VALUES
        (${row.temperature}, ${row.humidity}, ${row.soil_moisture},
         ${row.soil_raw_adc}, ${row.pump_status}, ${row.mqtt_topic})
      RETURNING id
    `;

    const id = (result as Array<{ id: number }>)[0].id;
    console.info(
      `[bridge] ✓ sensor_logs row ${id} — soil:${row.soil_moisture}% T:${row.temperature}°C pump:${row.pump_status}`,
    );
    return id;
  } catch (err) {
    console.error("[bridge] sensor_logs INSERT error:", err);
    return null;
  }
}

async function insertAlerts(
  db: NeonQueryFunction<false, false>,
  alerts: AlertLogRow[],
): Promise<void> {
  if (alerts.length === 0) return;

  for (const alert of alerts) {
    try {
      await db`
        INSERT INTO alert_logs
          (severity, alert_type, title, description, sensor_log_id)
        VALUES
          (${alert.severity}, ${alert.alert_type}, ${alert.title},
           ${alert.description}, ${alert.sensor_log_id})
      `;
    } catch (err) {
      console.error("[bridge] alert_logs INSERT error:", err);
    }
  }

  console.info(`[bridge] ✓ ${alerts.length} alert(s) inserted into alert_logs`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const db: NeonQueryFunction<false, false> = neon(DATABASE_URL);

  const options: IClientOptions = {
    clientId:        `agrisense_bridge_${Math.random().toString(16).slice(2, 10)}`,
    clean:           true,
    reconnectPeriod: 5000,
    connectTimeout:  15_000,
    keepalive:       60,
  };

  console.info(`[bridge] Connecting to MQTT broker: ${MQTT_BROKER_URL}`);
  const client: MqttClient = mqtt.connect(MQTT_BROKER_URL, options);

  client.on("connect", () => {
    console.info("[bridge] ✓ Connected to MQTT broker");
    client.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
      if (err) {
        console.error("[bridge] Subscribe error:", err.message);
      } else {
        console.info(`[bridge] ✓ Subscribed to topic: ${MQTT_TOPIC}`);
      }
    });
  });

  client.on("message", (_topic: string, payload: Buffer) => {
    const raw = payload.toString().trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[bridge] Invalid JSON:", raw);
      return;
    }

    if (!isValidPayload(parsed)) {
      console.warn("[bridge] Unexpected payload shape:", parsed);
      return;
    }

    const soilMoisture = adcToMoisturePercent(parsed.soil);

    const row: SensorLogRow = {
      temperature:   parsed.temperature,
      humidity:      parsed.humidity,
      soil_moisture: soilMoisture,
      soil_raw_adc:  parsed.soil,
      pump_status:   parsed.pump === 1,
      mqtt_topic:    MQTT_TOPIC,
    };

    // Fire-and-forget — Node.js handles the promise chain
    insertSensorLog(db, row)
      .then((sensorLogId) => {
        if (sensorLogId === null) return;
        const alerts = buildAlerts(row, sensorLogId);
        return insertAlerts(db, alerts);
      })
      .catch((err: unknown) => {
        console.error("[bridge] Unhandled error:", err);
      });
  });

  client.on("reconnect", () => console.info("[bridge] Reconnecting…"));
  client.on("offline",   () => console.warn("[bridge] Client offline"));
  client.on("error",     (err: Error) =>
    console.error("[bridge] MQTT error:", err.message),
  );

  // Graceful shutdown
  const shutdown = (): void => {
    console.info("\n[bridge] Shutting down…");
    client.end(true, () => process.exit(0));
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);
}

main();
