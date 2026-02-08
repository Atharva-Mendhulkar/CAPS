import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { LogCard, LogEntry } from "./LogCard";
import { useState } from "react";
import { ReasoningReplay } from "./ReasoningReplay";

interface LogsPanelProps {
  logs: LogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export function LogsPanel({ logs, isOpen, onClose }: LogsPanelProps) {
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!selectedLog) onClose();
            }}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-full max-w-2xl h-full max-h-[80vh] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-light text-white/90">Transaction Logs</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Logs list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-white/40 text-sm">No transaction logs yet</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <LogCard
                      key={log.id}
                      log={log}
                      onClick={() => setSelectedLog(log)}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Reasoning Replay */}
          {selectedLog && (
            <ReasoningReplay
              log={selectedLog}
              onClose={() => setSelectedLog(null)}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
