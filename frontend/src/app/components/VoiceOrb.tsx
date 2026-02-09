import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface VoiceOrbProps {
  state:
  | "idle"
  | "listening"
  | "processing"
  | "understanding"
  | "evaluating"
  | "checking"
  | "deciding"
  | "awaiting"
  | "executing"
  | "completed"
  | "blocked"
  | "error";
}

const stateLabels: Record<VoiceOrbProps["state"], string> = {
  idle: "Tap to speak",
  listening: "Listening…",
  processing: "Processing…",
  understanding: "Understanding intent…",
  evaluating: "Evaluating context…",
  checking: "Checking policies…",
  deciding: "Making decision…",
  awaiting: "Awaiting approval…",
  executing: "Executing payment…",
  completed: "Completed",
  blocked: "Blocked",
  error: "Error",
};

export function VoiceOrb({ state }: VoiceOrbProps) {
  const [waveformBars, setWaveformBars] = useState<number[]>([]);

  useEffect(() => {
    if (state === "listening") {
      // Generate random waveform heights
      const interval = setInterval(() => {
        setWaveformBars(Array.from({ length: 5 }, () => Math.random() * 40 + 20));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setWaveformBars([]);
    }
  }, [state]);

  const getOrbColor = () => {
    switch (state) {
      case "listening":
        return "from-blue-500/40 to-purple-500/40";
      case "processing":
      case "understanding":
      case "evaluating":
      case "checking":
      case "deciding":
        return "from-purple-500/40 to-pink-500/40";
      case "awaiting":
        return "from-yellow-500/40 to-orange-500/40";
      case "executing":
        return "from-green-500/40 to-emerald-500/40";
      case "completed":
        return "from-green-500/40 to-green-600/40";
      case "blocked":
      case "error":
        return "from-red-500/40 to-red-600/40";
      default:
        return "from-gray-500/20 to-gray-600/20";
    }
  };

  const isActive = state !== "idle" && state !== "completed" && state !== "blocked";

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Voice Orb */}
      <div className="relative">
        {/* Outer glow rings */}
        {isActive && (
          <>
            <motion.div
              className={`absolute inset-0 rounded-full bg-gradient-to-br ${getOrbColor()} blur-2xl`}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ width: "160px", height: "160px", left: "-20px", top: "-20px" }}
            />
            <motion.div
              className={`absolute inset-0 rounded-full bg-gradient-to-br ${getOrbColor()} blur-xl`}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.6, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2,
              }}
              style={{ width: "140px", height: "140px", left: "-10px", top: "-10px" }}
            />
          </>
        )}

        {/* Main orb */}
        <motion.div
          className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getOrbColor()} backdrop-blur-xl border border-white/10 flex items-center justify-center`}
          animate={
            isActive
              ? {
                scale: [1, 1.05, 1],
              }
              : {}
          }
          transition={{
            duration: 1.5,
            repeat: isActive ? Infinity : 0,
            ease: "easeInOut",
          }}
        >
          {/* Waveform inside orb when listening */}
          {state === "listening" && waveformBars.length > 0 && (
            <div className="flex items-center justify-center gap-1 h-12">
              {waveformBars.map((height, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white/80 rounded-full"
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>
          )}

          {/* Pulse dot when processing */}
          {state !== "listening" && state !== "idle" && (
            <motion.div
              className="w-4 h-4 rounded-full bg-white/90"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* Idle state */}
          {state === "idle" && (
            <div className="w-3 h-3 rounded-full bg-white/40" />
          )}
        </motion.div>
      </div>

      {/* State label */}
      <motion.p
        className="text-sm text-white/60 font-light tracking-wide"
        key={state}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {stateLabels[state]}
      </motion.p>
    </div>
  );
}
