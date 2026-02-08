import { motion } from "motion/react";
import { Check, Clock, X } from "lucide-react";

interface DecisionButtonsProps {
  onApprove: () => void;
  onWait: () => void;
  onDecline: () => void;
  show: boolean;
}

export function DecisionButtons({ onApprove, onWait, onDecline, show }: DecisionButtonsProps) {
  if (!show) return null;

  return (
    <motion.div
      className="flex items-center justify-center gap-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      {/* Decline */}
      <motion.button
        onClick={onDecline}
        className="w-16 h-16 rounded-full bg-red-500/20 backdrop-blur-xl border border-red-500/30 flex items-center justify-center group hover:bg-red-500/30 transition-all"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <X className="w-7 h-7 text-red-400 group-hover:text-red-300 transition-colors" />
      </motion.button>

      {/* Approve */}
      <motion.button
        onClick={onApprove}
        className="w-20 h-20 rounded-full bg-green-500/20 backdrop-blur-xl border border-green-500/30 flex items-center justify-center group hover:bg-green-500/30 transition-all shadow-lg shadow-green-500/10"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Check className="w-9 h-9 text-green-400 group-hover:text-green-300 transition-colors" />
      </motion.button>

      {/* Wait */}
      <motion.button
        onClick={onWait}
        className="w-16 h-16 rounded-full bg-yellow-500/20 backdrop-blur-xl border border-yellow-500/30 flex items-center justify-center group hover:bg-yellow-500/30 transition-all"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Clock className="w-7 h-7 text-yellow-400 group-hover:text-yellow-300 transition-colors" />
      </motion.button>
    </motion.div>
  );
}
