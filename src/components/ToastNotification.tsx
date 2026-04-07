import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { Button } from './ui/button';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastNotificationProps {
  toast: Toast | null;
  onClose: () => void;
}

export default function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info
  };

  const colors = {
    success: {
      bg: 'from-emerald-500/10 to-cyan-500/10',
      border: 'border-emerald-500/20',
      icon: 'text-emerald-400',
      glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]'
    },
    error: {
      bg: 'from-red-500/10 to-orange-500/10',
      border: 'border-red-500/20',
      icon: 'text-red-400',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]'
    },
    info: {
      bg: 'from-blue-500/10 to-cyan-500/10',
      border: 'border-blue-500/20',
      icon: 'text-blue-400',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]'
    }
  };

  const Icon = icons[toast.type];
  const colorScheme = colors[toast.type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className="fixed top-4 right-4 z-50 w-96"
      >
        <div className={`relative p-4 rounded-xl bg-gradient-to-r ${colorScheme.bg} border ${colorScheme.border} backdrop-blur-xl ${colorScheme.glow}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 bg-black/40 rounded-lg shrink-0`}>
              <Icon className={`w-5 h-5 ${colorScheme.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white mb-1">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-gray-400 leading-relaxed">{toast.message}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-6 w-6 shrink-0 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook for using toast
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (type: ToastType, title: string, message?: string) => {
    setToast({
      id: Date.now().toString(),
      type,
      title,
      message
    });
  };

  const hideToast = () => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    hideToast,
    showSuccess: (title: string, message?: string) => showToast('success', title, message),
    showError: (title: string, message?: string) => showToast('error', title, message),
    showInfo: (title: string, message?: string) => showToast('info', title, message)
  };
}
