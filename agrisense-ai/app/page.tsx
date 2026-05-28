"use client";

import { useAgriStore } from "@/lib/store";
import { useRealtimeData } from "@/hooks/useRealtimeData";
import { motion } from "framer-motion";
import HeroOverviewCard from "@/components/dashboard/HeroOverviewCard";
import ActivityOverviewCard from "@/components/dashboard/ActivityOverviewCard";
import GrowthAnalyticsCard from "@/components/dashboard/GrowthAnalyticsCard";
import CriticalAlertsCard from "@/components/dashboard/CriticalAlertsCard";
import ContainerMonitoringTable from "@/components/dashboard/ContainerMonitoringTable";
import WeatherWidget from "@/components/dashboard/WeatherWidget";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function DashboardPage() {
  useRealtimeData();
  const { sensorData } = useAgriStore();

  return (
    <motion.div
      className="px-4 sm:px-6 pb-8 max-w-[1600px] mx-auto"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Top stats bar */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 mb-5 pt-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: "#1e2b22" }}>
            Farm Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c72" }}>
            Smart Irrigation & AI Disease Monitoring — Live
          </p>
        </div>
        <WeatherWidget />
      </motion.div>

      {/* Hero Row */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 mb-5">
        <HeroOverviewCard />
        <ActivityOverviewCard />
      </motion.div>

      {/* Analytics Row */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <GrowthAnalyticsCard />
        <CriticalAlertsCard />
      </motion.div>

      {/* Container Table */}
      <motion.div variants={fadeUp}>
        <ContainerMonitoringTable />
      </motion.div>
    </motion.div>
  );
}
