"use client";

import React from 'react';
import { motion } from "motion/react";

const Shimmer = ({ className = '' }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-white/[0.04] rounded-lg ${className}`}>
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      animate={{ x: ['-100%', '100%'] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
    />
  </div>
);

export const OverviewSkeleton = () => (
  <div className="space-y-6 animate-in fade-in">
    {/* Title */}
    <div>
      <Shimmer className="h-8 w-64 mb-2" />
      <Shimmer className="h-4 w-48" />
    </div>

    {/* Stat cards */}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <Shimmer className="w-9 h-9 rounded-lg" />
            <Shimmer className="w-10 h-4" />
          </div>
          <Shimmer className="h-7 w-20 mb-2" />
          <Shimmer className="h-3 w-16" />
        </motion.div>
      ))}
    </div>

    {/* 3-col row */}
    <div className="grid lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
          className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
          <Shimmer className="h-5 w-32 mb-4" />
          <Shimmer className="h-[180px] w-full rounded-lg" />
        </motion.div>
      ))}
    </div>

    {/* Chart + Tasks */}
    <div className="grid lg:grid-cols-3 gap-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="lg:col-span-2 bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <Shimmer className="h-5 w-40 mb-4" />
        <Shimmer className="h-[200px] w-full rounded-lg" />
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
        <Shimmer className="h-5 w-28 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-black/30 border border-white/5 rounded-lg p-3">
              <Shimmer className="h-4 w-full mb-2" />
              <Shimmer className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </div>
);
