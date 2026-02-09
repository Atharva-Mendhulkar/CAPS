import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Mic, User, UserX } from "lucide-react";
import { VoiceOrb } from "./components/VoiceOrb";
import { AIProcessCloud } from "./components/AIProcessCloud";
import { DecisionButtons } from "./components/DecisionButtons";
import { LogsPanel } from "./components/LogsPanel";
import { LogEntry } from "./components/LogCard";
import { DelayedPaymentTimer } from "./components/DelayedPaymentTimer";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { processCommand, CommandResponse } from "../api/client";

type AppState =
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

interface DelayedPayment {
  id: string;
  amount: string;
  recipient: string;
  delayedUntil: Date;
  intent: any; // Store the intent for delayed execution
}

export default function App() {
  const [state, setState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [delayedPayment, setDelayedPayment] = useState<DelayedPayment | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Real Voice Input Hook
  const { isListening, transcript, startListening, stopListening } = useVoiceInput();

  // Effect to handle listening state changes
  useEffect(() => {
    if (isListening) {
      if (state !== "listening") setState("listening");
      if (transcript) setMessages([transcript]); // Show what is being heard
    } else if (state === "listening") {
      // Stopped listening, now processing
      handleVoiceEnd();
    }
  }, [isListening, transcript]);

  const startVoiceInput = () => {
    if (state !== "idle" && state !== "completed" && state !== "error") return;
    setMessages(["Listening..."]);
    startListening();
  };

  const handleVoiceEnd = async () => {
    if (!transcript.trim()) {
      setState("idle");
      setMessages([]);
      return;
    }

    setState("processing");
    setMessages(["Processing audio...", `Heard: "${transcript}"`]);

    // Artificial delay for UX (to show processing state)
    await new Promise(r => setTimeout(r, 800));

    try {
      setState("understanding");
      setMessages(["Interpreting command...", `Input: ${transcript}`]);

      const result = await processCommand(transcript);

      // Map backend result to UI state
      processBackendResult(result);

    } catch (e) {
      console.error(e);
      setState("error");
      setMessages(["Error connecting to server.", "Please try again."]);
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const processBackendResult = async (result: CommandResponse) => {
    const intentType = result.intent?.intent_type;

    // Handle Balance Inquiry - Text Only Response
    if (intentType === 'BALANCE_INQUIRY' && result.execution_result) {
      // Use 'evaluating' to keep the cloud active/typing
      setState("evaluating");
      setMessages([
        `Your current balance is ₹${result.execution_result.balance}.`,
        `Today's spending: ₹${result.execution_result.daily_spend} of ₹${result.execution_result.daily_limit || 2000} daily limit.`
      ]);

      // Wait for reading then finish
      setTimeout(() => {
        setState("completed");
        setTimeout(() => setState("idle"), 2000);
      }, 6000);
      return;
    }

    // Handle Transaction History - Text Only Response
    if (intentType === 'TRANSACTION_HISTORY' && result.execution_result?.history) {
      setState("evaluating");
      const historyMsgs = result.execution_result.history.length === 0
        ? ["No recent transactions found."]
        : [
          "Your recent transactions:",
          // @ts-ignore
          ...result.execution_result.history.slice(0, 4).map((txn: any) =>
            `• ₹${txn.amount} to ${txn.merchant_vpa} (${new Date(txn.timestamp).toLocaleDateString()})`
          )
        ];
      setMessages(historyMsgs);

      setTimeout(() => {
        setState("completed");
        setTimeout(() => setState("idle"), 2000);
      }, 9000);
      return;
    }

    // 1. Show Intent (For Payments)
    setState("evaluating");
    const steps = [
      `Intent: ${result.intent?.intent_type}`,
      `Confidence: ${((result.intent?.confidence_score || 0) * 100).toFixed(0)}%`,
      `Amount: ${result.intent?.amount || 'N/A'}`,
      `Merchant: ${result.intent?.merchant_vpa || 'N/A'}`,
    ];
    setMessages(steps);
    await new Promise(r => setTimeout(r, 1000));

    // 2. Show Risk
    setState("checking");
    steps.push(`Risk Score: ${result.risk_info?.score}`);
    if (result.risk_info?.violations && result.risk_info.violations.length > 0) {
      steps.push(`Violations: ${result.risk_info.violations.length}`);
    }
    setMessages([...steps]);
    await new Promise(r => setTimeout(r, 800));

    // 3. Decision
    setState("deciding");

    // Logic for Busy Mode or High Risk
    if (result.policy_decision === "APPROVE") {
      if (isBusy) {
        // Delayed Payment Logic
        handleBusyDelay(result);
      } else {
        // Auto-execute
        setState("executing");
        setMessages([...steps, "Auto-approving low-risk transaction..."]);
        await new Promise(r => setTimeout(r, 1000));

        completeTransaction(result, "approved");
      }
    } else if (result.policy_decision === "DENY") {
      setState("blocked");
      setMessages([...steps, `Blocked: ${result.message}`]);
      completeTransaction(result, "declined");
    } else {
      // COOLDOWN or ESCALATE -> Ask user
      setState("awaiting");
      setMessages([...steps, "Manual approval required."]);
    }
  };

  const completeTransaction = (result: CommandResponse, decision: "approved" | "declined") => {
    // Create Log Entry
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      command: result.intent?.raw_input || "",
      amount: result.intent?.amount?.toString() || "0",
      recipient: result.intent?.merchant_vpa || "Unknown",
      description: result.intent?.intent_type || "Transaction",
      confidence: Number((result.intent?.confidence_score || 0) * 100),
      context: [`Risk: ${result.risk_info?.score}`, `Conf: ${((result.intent?.confidence_score || 0) * 100).toFixed(0)}%`],
      policyChecks: result.risk_info?.violations || [],
      decision: decision,
      steps: [`Result: ${result.status}`, `Ref: ${result.execution_result?.reference_number || 'N/A'}`],
    };

    setLogs(prev => [newLog, ...prev]);

    if (decision === "approved") {
      setState("completed");
    }

    setTimeout(() => {
      setState("idle");
      setMessages([]);
    }, 3000);
  };

  const handleBusyDelay = (result: CommandResponse) => {
    const delayedUntil = new Date();
    delayedUntil.setSeconds(delayedUntil.getSeconds() + 30);

    setDelayedPayment({
      id: Date.now().toString(),
      amount: result.intent?.amount?.toString() || "0",
      recipient: result.intent?.merchant_vpa || "Unknown",
      delayedUntil,
      intent: result.intent,
    });

    setState("completed");
    setMessages(["User busy. Payment delayed 30s."]);
    setTimeout(() => {
      setState("idle");
      setMessages([]);
    }, 2000);
  };

  const handleApprove = async () => {
    // In a real app, we would call an endpoint to approve the pending transaction
    // For now, we simulate the execution of the last command
    setState("executing");
    setMessages(["User verified.", "Executing..."]);
    await new Promise(r => setTimeout(r, 1000));

    // We don't have the last result stored easily if we just came from 'awaiting'
    // Ideally we should store 'pendingResult' in state. 
    // For this demo, we'll just log a generic success.
    setState("completed");
    setTimeout(() => setState("idle"), 2000);
  };

  const handleDecline = () => {
    setState("blocked");
    setTimeout(() => setState("idle"), 2000);
  };

  const handleWait = () => {
    // Similar to busy delay
    setState("idle");
  };

  const handleDelayedTimeUp = () => {
    // Execute the delayed payment
    if (delayedPayment) {
      setState("executing");
      setMessages(["Executing delayed payment..."]);
      setTimeout(() => {
        setState("completed");
        setDelayedPayment(null);
        setTimeout(() => setState("idle"), 2000);
      }, 1500);
    }
  };

  const handleCancelDelayed = () => {
    setDelayedPayment(null);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white relative overflow-hidden">
      {/* Backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      {/* Delayed Payment Timer */}
      <AnimatePresence>
        {delayedPayment && (
          <DelayedPaymentTimer
            payment={delayedPayment}
            onCancel={handleCancelDelayed}
            onTimeUp={handleDelayedTimeUp}
          />
        )}
      </AnimatePresence>

      {/* Busy Mode Toggle */}
      <motion.div
        className="absolute top-6 left-1/2 -translate-x-1/2 z-30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => setIsBusy(!isBusy)}
          className={`px-4 py-2 rounded-full backdrop-blur-xl border transition-all flex items-center gap-2 ${isBusy
            ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-300"
            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
        >
          {isBusy ? (
            <>
              <UserX className="w-4 h-4" />
              <span className="text-xs font-medium">Busy Mode</span>
            </>
          ) : (
            <>
              <User className="w-4 h-4" />
              <span className="text-xs font-light">Available</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Logs Toggle */}
      <motion.button
        onClick={() => setLogsOpen(true)}
        className="absolute top-6 right-6 z-30 w-12 h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <FileText className="w-5 h-5 text-white/60 group-hover:text-white/90 transition-colors" />
        {logs.length > 0 && (
          <motion.div
            className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-xs font-medium"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {logs.length}
          </motion.div>
        )}
      </motion.button>

      {/* Main Interface */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-12">
        {/* Voice Orb */}
        <div
          onClick={state === "idle" || state === "completed" || state === "error" ? startVoiceInput : undefined}
          className={state === "idle" || state === "completed" || state === "error" ? "cursor-pointer" : ""}
        >
          <VoiceOrb state={state} />
        </div>

        {/* AI Cloud Messages */}
        <div className="w-full max-w-md">
          <AIProcessCloud messages={messages} isStreaming={state !== "idle" && state !== "completed"} />
        </div>

        {/* Buttons */}
        <DecisionButtons
          show={state === "awaiting"}
          onApprove={handleApprove}
          onWait={handleWait}
          onDecline={handleDecline}
        />

        {/* Idle Hint */}
        {state === "idle" && messages.length === 0 && (
          <motion.div
            className="absolute bottom-12 text-center space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-2 text-white/30">
              <Mic className="w-4 h-4" />
              <p className="text-sm font-light">Tap the orb to speak</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/20">Real Transactions Enabled</p>
            </div>
          </motion.div>
        )}
      </div>

      <LogsPanel logs={logs} isOpen={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
