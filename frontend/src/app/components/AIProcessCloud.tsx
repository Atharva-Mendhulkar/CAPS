import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

interface AIProcessCloudProps {
  messages: string[];
  isStreaming: boolean;
}

export function AIProcessCloud({ messages, isStreaming }: AIProcessCloudProps) {
  const [displayedMessages, setDisplayedMessages] = useState<Array<{ text: string; id: number }>>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  useEffect(() => {
    if (messages.length === 0) {
      setDisplayedMessages([]);
      setCurrentMessageIndex(0);
      setCurrentCharIndex(0);
      return;
    }

    if (currentMessageIndex < messages.length) {
      const currentMessage = messages[currentMessageIndex];

      if (currentCharIndex < currentMessage.length) {
        const timeout = setTimeout(() => {
          setCurrentCharIndex(currentCharIndex + 1);
        }, 20); // Typing speed

        return () => clearTimeout(timeout);
      } else {
        // Current message complete, move to next
        const timeout = setTimeout(() => {
          setDisplayedMessages((prev) => [
            ...prev.filter((m) => m.id !== currentMessageIndex),
            { text: currentMessage, id: currentMessageIndex },
          ]);
          setCurrentMessageIndex(currentMessageIndex + 1);
          setCurrentCharIndex(0);
        }, 100);

        return () => clearTimeout(timeout);
      }
    }
  }, [messages, currentMessageIndex, currentCharIndex]);

  const currentlyTyping = currentMessageIndex < messages.length && currentCharIndex > 0;
  const currentText = messages[currentMessageIndex]?.substring(0, currentCharIndex) || "";

  if (messages.length === 0) return null;

  return (
    <motion.div
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="space-y-3 font-light text-sm">
          <AnimatePresence mode="popLayout">
            {displayedMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="text-white/70 leading-relaxed"
              >
                {msg.text}
              </motion.div>
            ))}
            
            {currentlyTyping && (
              <motion.div
                key={`typing-${currentMessageIndex}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-white/90 leading-relaxed flex items-center gap-2"
              >
                <span className="font-mono">{currentText}</span>
                <motion.span
                  className="inline-block w-0.5 h-4 bg-white/90"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
