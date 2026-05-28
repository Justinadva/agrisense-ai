"use client";

import { useEffect } from "react";
import { iotSimulator, type MqttSensorData, type MqttStatus } from "@/lib/websocket";
import { useAgriStore } from "@/lib/store";
import type { ChartPoint, LogEntry, AlertData, DetectionResult } from "@/lib/mockData";

/**
 * Connects the IoT simulator (MQTT or fallback) to the Zustand store.
 * Call once in a top-level component (e.g. each page layout).
 */
export function useRealtimeData(): void {
  const {
    updateSensorData,
    addChartPoint,
    addDetection,
    addLog,
    addAlert,
    setMqttStatus,
  } = useAgriStore();

  useEffect(() => {
    iotSimulator.connect();

    const handleSensor = (data: MqttSensorData): void => updateSensorData(data);
    const handleChart = (data: ChartPoint): void => addChartPoint(data);
    const handleDetection = (data: DetectionResult): void => addDetection(data);
    const handleLog = (data: LogEntry): void => addLog(data);
    const handleAlert = (data: AlertData): void => addAlert(data);
    const handleStatus = (status: MqttStatus): void => setMqttStatus(status);

    iotSimulator.on("sensor", handleSensor);
    iotSimulator.on("chart", handleChart);
    iotSimulator.on("detection", handleDetection);
    iotSimulator.on("log", handleLog);
    iotSimulator.on("alert", handleAlert);
    iotSimulator.on("status", handleStatus);

    return () => {
      iotSimulator.off("sensor", handleSensor);
      iotSimulator.off("chart", handleChart);
      iotSimulator.off("detection", handleDetection);
      iotSimulator.off("log", handleLog);
      iotSimulator.off("alert", handleAlert);
      iotSimulator.off("status", handleStatus);
    };
  }, [
    updateSensorData,
    addChartPoint,
    addDetection,
    addLog,
    addAlert,
    setMqttStatus,
  ]);
}
