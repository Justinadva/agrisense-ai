"use client";

import { useEffect } from "react";
import { iotSimulator } from "@/lib/websocket";
import { useAgriStore } from "@/lib/store";
import { SensorData } from "@/lib/mockData";

export function useRealtimeData() {
  const {
    updateSensorData,
    addChartPoint,
    addDetection,
    addLog,
    addAlert,
  } = useAgriStore();

  useEffect(() => {
    iotSimulator.connect();

    const handleSensor = (data: unknown) => updateSensorData(data as SensorData);
    const handleChart = (data: unknown) => addChartPoint(data as Parameters<typeof addChartPoint>[0]);
    const handleDetection = (data: unknown) => addDetection(data as Parameters<typeof addDetection>[0]);
    const handleLog = (data: unknown) => addLog(data as Parameters<typeof addLog>[0]);
    const handleAlert = (data: unknown) => addAlert(data as Parameters<typeof addAlert>[0]);

    iotSimulator.on("sensor", handleSensor);
    iotSimulator.on("chart", handleChart);
    iotSimulator.on("detection", handleDetection);
    iotSimulator.on("log", handleLog);
    iotSimulator.on("alert", handleAlert);

    return () => {
      iotSimulator.off("sensor", handleSensor);
      iotSimulator.off("chart", handleChart);
      iotSimulator.off("detection", handleDetection);
      iotSimulator.off("log", handleLog);
      iotSimulator.off("alert", handleAlert);
    };
  }, [updateSensorData, addChartPoint, addDetection, addLog, addAlert]);
}
