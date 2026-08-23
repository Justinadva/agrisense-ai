#!/usr/bin/env node
/**
 * scripts/serial-to-neon.ts
 *
 * Arduino Uno (USB Serial) → Neon PostgreSQL bridge.
 *
 * Cara pakai di Raspberry Pi / komputer gateway:
 *   npx ts-node scripts/serial-to-neon.ts
 *   ATAU setelah di-compile:
 *   node dist/serial-to-neon.js
 *
 * Environment variables (set di .env atau shell):
 *   DATABASE_URL   — Neon connection string (postgresql://...)
 *   SERIAL_PORT    — Port serial Arduino, misal /dev/ttyUSB0 atau COM3
 *   BAUD_RATE      — Baud rate Arduino (default: 9600)
 *
 * Format data yang dikirim Arduino via Serial (JSON, 1 baris per reading):
 *   {"temperature":28.5,"humidity":72,"soil":450,"pump":0}
 *
 * Kolom:
 *   temperature — float (°C)
 *   humidity    — float (%)
 *   soil        — int   ADC 0–1023 (resistive sensor, dry=tinggi)
 *   pump        — int   0=mati, 1=nyala
 */

import * as dotenv from "dotenv";
dotenv.config();

import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ─── Environment ───────────────────────────────────────────────────────────────

const DATABASE_URL: string = process.env.DATABASE_URL ?? "";
const SERIAL_PORT: string  = process.env.SERIAL_PORT  ?? "/dev/ttyUSB0";
const BAUD_RATE: number    = parseInt(process.env.BAUD_RATE ?? "9600", 10);

if (!DATABASE_URL) {
  console.error(
    "[serial-bridge] ERROR: DATABASE_URL harus diset di file .env\n" +
    "  Contoh: DATABASE_URL=postgresql://user:pass@host/db?sslmode=require\n",
  );
  process.exit(1);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Payload JSON dari Arduino via Serial */
interface ArduinoPayload {
  temperature: number;
  humidity:    number;
  soil:        number; // ADC 0–1023
  pump:        number; // 0 = mati, 1 = nyala
}

/** Row untuk tabel sensor_logs */
interface SensorLogRow {
  temperature:   number;
  humidity:      number;
  soil_moisture: number; // hasil konversi ADC → persen
  soil_raw_adc:  number;
  pump_status:   boolean;
}

/** Row untuk tabel alert_logs */
interface AlertLogRow {
  severity:      "low" | "medium" | "high";
  alert_type:    "warning" | "error" | "info" | "success";
  title:         string;
  description:   string;
  sensor_log_id: number | null;
}

// ─── ADC → Moisture % ──────────────────────────────────────────────────────────
// Sensor resistif: kering = ADC tinggi (~1023), basah = ADC rendah (~0)
// Sesuaikan DRY_ADC dan WET_ADC dengan kalibrasi sensor kamu
const DRY_ADC = 1023;
const WET_ADC = 0;

function adcToMoisturePct(adc: number): number {
  return Math.min(
    100,
    Math.max(0, Math.round(((DRY_ADC - adc) / (DRY_ADC - WET_ADC)) * 100)),
  );
}

// ─── Payload validation ────────────────────────────────────────────────────────

function isValidPayload(value: unknown): value is ArduinoPayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.temperature === "number" &&
    typeof obj.humidity    === "number" &&
    typeof obj.soil        === "number" &&
    typeof obj.pump        === "number"
  );
}

// ─── Threshold alerts ──────────────────────────────────────────────────────────

function buildAlerts(row: SensorLogRow, sensorLogId: number): AlertLogRow[] {
  const alerts: AlertLogRow[] = [];

  if (row.soil_moisture < 30) {
    alerts.push({
      severity: "high", alert_type: "error",
      title: "Critical Moisture Level",
      description: `Soil moisture at ${row.soil_moisture}% — immediate irrigation required`,
      sensor_log_id: sensorLogId,
    });
  } else if (row.soil_moisture < 50) {
    alerts.push({
      severity: "medium", alert_type: "warning",
      title: "Low Soil Moisture",
      description: `Soil moisture at ${row.soil_moisture}% — below optimal threshold`,
      sensor_log_id: sensorLogId,
    });
  }

  if (row.temperature > 35) {
    alerts.push({
      severity: "medium", alert_type: "warning",
      title: "High Temperature",
      description: `Temperature at ${row.temperature}°C — heat stress risk`,
      sensor_log_id: sensorLogId,
    });
  }

  if (row.humidity > 90) {
    alerts.push({
      severity: "low", alert_type: "info",
      title: "High Humidity",
      description: `Humidity at ${row.humidity}% — increased fungal disease risk`,
      sensor_log_id: sensorLogId,
    });
  }

  return alerts;
}

// ─── Neon INSERT helpers ───────────────────────────────────────────────────────

async function insertSensorLog(
  db: NeonQueryFunction<false, false>,
  row: SensorLogRow,
): Promise<number | null> {
  try {
    const result = await db`
      INSERT INTO sensor_logs
        (temperature, humidity, soil_moisture, soil_raw_adc, pump_status)
      VALUES
        (${row.temperature}, ${row.humidity}, ${row.soil_moisture},
         ${row.soil_raw_adc}, ${row.pump_status})
      RETURNING id
    `;

    const id = (result as Array<{ id: number }>)[0].id;
    console.info(
      `[serial-bridge] ✓ INSERT sensor_logs id=${id}` +
      ` | soil:${row.soil_moisture}% (raw:${row.soil_raw_adc})` +
      ` | T:${row.temperature}°C | H:${row.humidity}%` +
      ` | pump:${row.pump_status ? "ON" : "OFF"}`,
    );
    return id;
  } catch (err) {
    console.error("[serial-bridge] sensor_logs INSERT error:", err);
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
      console.error("[serial-bridge] alert_logs INSERT error:", err);
    }
  }
  console.info(`[serial-bridge] ✓ ${alerts.length} alert(s) inserted`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const db: NeonQueryFunction<false, false> = neon(DATABASE_URL);

  console.info(`[serial-bridge] Membuka port serial: ${SERIAL_PORT} @ ${BAUD_RATE} baud`);

  const port = new SerialPort({
    path:     SERIAL_PORT,
    baudRate: BAUD_RATE,
    autoOpen: false,
  });

  // Parser: baca satu baris per "\n" (Arduino Serial.println)
  const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

  port.open((err) => {
    if (err) {
      console.error(
        `[serial-bridge] Gagal membuka port ${SERIAL_PORT}:`, err.message,
        "\nPastikan:\n" +
        "  1. Arduino sudah terhubung via USB\n" +
        "  2. SERIAL_PORT sudah benar (cek dengan: ls /dev/tty*)\n" +
        "  3. Tidak ada program lain (Serial Monitor) yang membuka port yang sama\n",
      );
      process.exit(1);
    }
    console.info(`[serial-bridge] ✓ Port ${SERIAL_PORT} terbuka`);
    console.info("[serial-bridge] Menunggu data dari Arduino...\n");
  });

  // Proses setiap baris yang diterima dari Arduino
  parser.on("data", (line: string) => {
    const raw = line.trim();
    if (!raw || raw.startsWith("//")) return; // abaikan baris kosong / komentar

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Bukan JSON (misal: pesan debug Arduino) — tampilkan saja
      console.log(`[Arduino] ${raw}`);
      return;
    }

    if (!isValidPayload(parsed)) {
      console.warn("[serial-bridge] Payload tidak valid:", parsed);
      return;
    }

    const soilMoisture = adcToMoisturePct(parsed.soil);

    const row: SensorLogRow = {
      temperature:   parsed.temperature,
      humidity:      parsed.humidity,
      soil_moisture: soilMoisture,
      soil_raw_adc:  parsed.soil,
      pump_status:   parsed.pump === 1,
    };

    // Insert ke Neon (async, fire-and-forget)
    insertSensorLog(db, row)
      .then((sensorLogId) => {
        if (sensorLogId === null) return;
        const alerts = buildAlerts(row, sensorLogId);
        return insertAlerts(db, alerts);
      })
      .catch((err: unknown) => {
        console.error("[serial-bridge] Unhandled error:", err);
      });
  });

  port.on("error",  (err) => console.error("[serial-bridge] Port error:", err.message));
  port.on("close",  ()    => console.warn("[serial-bridge] Port ditutup"));

  // Graceful shutdown
  const shutdown = (): void => {
    console.info("\n[serial-bridge] Menutup koneksi serial...");
    port.close(() => process.exit(0));
  };
  process.on("SIGINT",  shutdown);
  process.on("SIGTERM", shutdown);
}

main();
