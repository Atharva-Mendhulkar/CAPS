import { motion } from "motion/react";
import { X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { LogEntry } from "./LogCard";
import { useEffect, useState } from "react";

interface ReasoningReplayProps {
  log: LogEntry;
  onClose: () => void;
}

export function ReasoningReplay({ log, onClose }: ReasoningReplayProps) {
  const [displayedSteps, setDisplayedSteps] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setDisplayedSteps([]);
    setCurrentIndex(0);
  }, [log]);

  useEffect(() => {
    if (currentIndex < log.steps.length) {
      const timeout = setTimeout(() => {
        setDisplayedSteps((prev) => [...prev, log.steps[currentIndex]]);
        setCurrentIndex(currentIndex + 1);
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, log.steps]);

  const getDecisionIcon = () => {
    switch (log.decision) {
      case "approved":
        return <CheckCircle2 className="w-6 h-6 text-green-400" />;
      case "declined":
        return <XCircle className="w-6 h-6 text-red-400" />;
      case "waiting":
        return <Clock className="w-6 h-6 text-yellow-400" />;
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Replay panel */}
      <motion.div
        className="relative w-full max-w-xl max-h-[80vh] bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {getDecisionIcon()}
            <h2 className="text-lg font-light text-white/90">AI Reasoning Replay</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transaction info */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider">Command</p>
            <p className="text-white/90 font-light">{log.command}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wider">Amount</p>
              <p className="text-2xl font-light text-white/90">{log.amount}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-white/40 uppercase tracking-wider">Recipient</p>
              <p className="text-lg font-light text-white/90">{log.recipient}</p>
            </div>
          </div>

          {/* AI Processing Steps */}
          <div className="space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">AI Processing</p>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-3">
              {displayedSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-white/70 leading-relaxed font-light"
                >
                  {step}
                </motion.div>
              ))}
              
              {currentIndex < log.steps.length && (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.span
                    className="inline-block w-1 h-4 bg-white/90 rounded"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </motion.div>
              )}
            </div>
          </div>

          {/* Context used */}
          <div className="space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">Context Evaluated</p>
            <div className="space-y-2">
              {log.context.map((ctx, index) => (
                <div
                  key={index}
                  className="text-sm text-white/50 bg-white/5 rounded-lg px-3 py-2 font-light"
                >
                  {ctx}
                </div>
              ))}
            </div>
          </div>

          {/* Policy checks */}
          <div className="space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">Policy Checks</p>
            <div className="space-y-2">
              {log.policyChecks.map((check, index) => (
                <div
                  key={index}
                  className="text-sm text-white/50 bg-white/5 rounded-lg px-3 py-2 font-light flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-400/60" />
                  {check}
                </div>
              ))}
            </div>
          </div>

          {/* Final decision */}
          <div className="space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">Final Decision</p>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getDecisionIcon()}
                <p className="text-white/90 font-medium capitalize">{log.decision}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40">Confidence</p>
                <p className="text-lg font-light text-white/90">{log.confidence}%</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
