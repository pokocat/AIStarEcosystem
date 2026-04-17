"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Plus, X } from 'lucide-react';
import type { Lang } from "../../translations";
import { FAB_ACTIONS } from "@/constants/fab-actions";

export const FloatingActions = ({ lang: _lang, onNavigate }: { lang: Lang; onNavigate: (page: string) => void }) => {
  const [open, setOpen] = useState(false);

  const handleAction = (id: string) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Action items */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[-1]"
            />
            {FAB_ACTIONS.map((action, i) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ delay: (FAB_ACTIONS.length - 1 - i) * 0.05, type: 'spring', damping: 20 }}
                onClick={() => handleAction(action.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${action.bg} border border-white/5 backdrop-blur-xl transition-all group`}
              >
                <action.icon className={`w-4 h-4 ${action.color}`} />
                <span className="text-sm text-white font-medium whitespace-nowrap">{action.label}</span>
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all ${
          open
            ? 'bg-gray-800 shadow-gray-800/20'
            : 'bg-gradient-to-br from-cyan-500 to-purple-600 shadow-cyan-500/25'
        }`}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <X className="w-5 h-5 text-gray-300" /> : <Plus className="w-5 h-5 text-white" />}
        </motion.div>
      </motion.button>
    </div>
  );
};
