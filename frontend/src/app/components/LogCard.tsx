import { motion } from "motion/react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export interface LogEntry {
  id: string;
  timestamp: Date;
  command: string;
  amount: string;
  recipient: string;
  description: string;
  confidence: number;
  context: string[];
  policyChecks: string[];
  decision: "approved" | "declined" | "waiting";
  steps: string[];
}

interface LogCardProps {
  log: LogEntry;
  onClick: () => void;
}

export function LogCard({ log, onClick }: LogCardProps) {
  const getDecisionIcon = () => {
    switch (log.decision) {
      case "approved":
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "declined":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "waiting":
        return <Clock className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getDecisionColor = () => {
    switch (log.decision) {
      case "approved":
        return "border-green-500/20 bg-green-500/5";
      case "declined":
        return "border-red-500/20 bg-red-500/5";
      case "waiting":
        return "border-yellow-500/20 bg-yellow-500/5";
    }
  };

  return (
    <motion.button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl backdrop-blur-xl border ${getDecisionColor()} hover:bg-white/5 transition-all`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2">
            {getDecisionIcon()}
            <p className="text-white/90 font-medium">{log.command}</p>
          </div>

          {/* Amount and recipient */}
          <div className="space-y-1">
            <p className="text-2xl font-light text-white/90">{log.amount}</p>
            <p className="text-sm text-white/50">to {log.recipient}</p>
          </div>

          {/* Description */}
          {log.description && (
            <p className="text-xs text-white/40 italic">{log.description}</p>
          )}

          {/* Confidence score */}
          <div className="flex items-center gap-2">
            <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                style={{ width: `${log.confidence}%` }}
              />
            </div>
            <p className="text-xs text-white/40">{log.confidence}% confidence</p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-right">
          <p className="text-xs text-white/30">
            {log.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
