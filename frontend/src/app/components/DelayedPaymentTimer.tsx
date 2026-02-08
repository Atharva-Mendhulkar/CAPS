import { motion } from "motion/react";
import { Clock, X } from "lucide-react";
import { useEffect, useState } from "react";

interface DelayedPayment {
  id: string;
  amount: string;
  recipient: string;
  delayedUntil: Date;
}

interface DelayedPaymentTimerProps {
  payment: DelayedPayment | null;
  onCancel: () => void;
  onTimeUp: () => void;
}

export function DelayedPaymentTimer({ payment, onCancel, onTimeUp }: DelayedPaymentTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!payment) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = payment.delayedUntil.getTime();
      const diff = Math.max(0, target - now);

      setTimeRemaining(diff);

      if (diff === 0) {
        onTimeUp();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [payment, onTimeUp]);

  if (!payment) return null;

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <motion.div
      className="fixed top-6 left-6 z-30"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-4 pr-12 shadow-lg relative">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-yellow-300/60 uppercase tracking-wider">Delayed Payment</p>
            <p className="text-sm text-white/90 font-medium">{payment.amount} → {payment.recipient}</p>
            <div className="flex items-center gap-2">
              <div className="text-lg font-mono text-yellow-400">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <div className="h-1 flex-1 bg-yellow-500/20 rounded-full overflow-hidden w-20">
                <motion.div
                  className="h-full bg-yellow-400"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: timeRemaining / 1000, ease: "linear" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>
    </motion.div>
  );
}
