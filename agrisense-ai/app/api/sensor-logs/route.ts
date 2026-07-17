// app/api/sensor-logs/route.ts
// Server-side API Route — queries Neon PostgreSQL directly.
// Called by useRealtimeData hook via fetch (client cannot access Neon directly).
//
// Endpoints:
//   GET  /api/sensor-logs?limit=48  → returns latest N rows (ascending chronological)
//   GET  /api/sensor-logs?latest=1  → returns only the single newest row
//   GET  /api/sensor-logs?schema=1  → returns column names of sensor_logs (debug)
//   POST /api/sensor-logs           → inserts a new row from ESP8266 payload

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// ─── Row shape matching actual public.sensor_logs in Neon ───────────────────
// Columns: id, temperature, humidity, soil_moisture, created_at
// Optional columns (add via ALTER TABLE if needed): soil_raw_adc, pump_status
export interface SensorLogRow {
  id: number;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  soil_raw_adc?: number;
  pump_status?: boolean;
  created_at: string;
}

/** Payload expected from ESP8266 via POST /api/sensor-logs */
interface Esp8266PostBody {
  temperature: number;
  humidity: number;
  soil_moisture: number;
  soil_raw_adc?: number;
  pump_status?: boolean;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latestOnly = searchParams.get("latest") === "1";
  const schemaOnly = searchParams.get("schema") === "1";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "48", 10), 200);

  try {
    // ── Schema discovery — lists actual columns in Neon (debug only) ──────────
    if (schemaOnly) {
      const cols = await sql`
        SELECT column_name, data_type
        FROM   information_schema.columns
        WHERE  table_name = 'sensor_logs'
        ORDER  BY ordinal_position
      `;
      return NextResponse.json({ columns: cols });
    }

    // ── Single latest row for polling fallback ────────────────────────────────
    if (latestOnly) {
      const rows = (await sql`
        SELECT *
        FROM   sensor_logs
        ORDER  BY created_at DESC
        LIMIT  1
      `) as unknown as SensorLogRow[];

      if (rows.length === 0) {
        return NextResponse.json({ row: null });
      }

      return NextResponse.json({ row: rows[0] });
    }

    // ── Multiple rows for initial chart history (ascending chronological) ──────
    const rows = (await sql`
      SELECT *
      FROM   (
        SELECT * FROM sensor_logs
        ORDER  BY created_at DESC
        LIMIT  ${limit}
      ) sub
      ORDER  BY created_at ASC
    `) as unknown as SensorLogRow[];

    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/sensor-logs] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST /api/sensor-logs ─────────────────────────────────────────────────────────────
// Receives sensor payload from ESP8266 and inserts into Neon sensor_logs.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Esp8266PostBody;

    // Basic validation
    if (
      typeof body.temperature   !== "number" ||
      typeof body.humidity      !== "number" ||
      typeof body.soil_moisture !== "number"
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: temperature, humidity, soil_moisture" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO sensor_logs
        (temperature, humidity, soil_moisture, soil_raw_adc, pump_status)
      VALUES
        (
          ${body.temperature},
          ${body.humidity},
          ${body.soil_moisture},
          ${body.soil_raw_adc   ?? null},
          ${body.pump_status    ?? false}
        )
      RETURNING id, created_at
    `;

    const inserted = (result as Array<{ id: number; created_at: string }>)[0];
    console.info(
      `[api/sensor-logs] POST ✓ row ${inserted.id} —` +
      ` soil:${body.soil_moisture}% T:${body.temperature}°C H:${body.humidity}%` +
      ` pump:${body.pump_status ?? false}`,
    );

    return NextResponse.json({ success: true, id: inserted.id, created_at: inserted.created_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/sensor-logs] POST error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
