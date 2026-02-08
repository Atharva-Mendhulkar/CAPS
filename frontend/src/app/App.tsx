import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Mic, User, UserX } from "lucide-react";
import { VoiceOrb } from "./components/VoiceOrb";
import { AIProcessCloud } from "./components/AIProcessCloud";
import { DecisionButtons } from "./components/DecisionButtons";
import { LogsPanel } from "./components/LogsPanel";
import { LogEntry } from "./components/LogCard";
import { DelayedPaymentTimer } from "./components/DelayedPaymentTimer";

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
  | "blocked";

type RiskLevel = "low" | "medium" | "high";

interface DelayedPayment {
  id: string;
  amount: string;
  recipient: string;
  delayedUntil: Date;
  scenario: any;
}

// Mock scenarios for demo
const mockScenarios = [
  {
    command: "Send $50 to Sarah for dinner",
    amount: "$50.00",
    recipient: "Sarah Johnson",
    description: "Dinner split",
    riskLevel: "low" as RiskLevel,
    steps: [
      "Interpreting payment request…",
      "Extracting amount: $50.00",
      "Identifying recipient: Sarah Johnson",
      "Checking location safety: Home (safe zone)",
      "Evaluating spending rules: Within daily limit",
      "Risk score: Low",
      "Auto-approving low-risk transaction…",
    ],
    context: [
      "Location: Home",
      "Time: Evening",
      "Recent transaction: None in last 24h to this recipient",
    ],
    policyChecks: [
      "Amount below $100 threshold",
      "Recipient is verified contact",
      "Transaction frequency normal",
      "Device is authenticated",
    ],
    confidence: 94,
  },
  {
    command: "Transfer $500 to Unknown Account",
    amount: "$500.00",
    recipient: "Unknown Account",
    description: "Large transfer to new recipient",
    riskLevel: "high" as RiskLevel,
    steps: [
      "Interpreting payment request…",
      "Extracting amount: $500.00",
      "Identifying recipient: Unknown Account",
      "⚠️ Warning: New recipient detected",
      "⚠️ Warning: Large amount detected",
      "Risk score: High",
      "Decision requires user approval…",
    ],
    context: [
      "Location: Unknown",
      "Time: Late night",
      "Recent transaction: First time to this recipient",
    ],
    policyChecks: [
      "⚠️ Amount above $100 threshold",
      "⚠️ Recipient not in contacts",
      "⚠️ Unusual transaction time",
      "Device is authenticated",
    ],
    confidence: 62,
  },
  {
    command: "Pay $15 to Coffee Shop",
    amount: "$15.00",
    recipient: "Brew & Co.",
    description: "Coffee purchase",
    riskLevel: "low" as RiskLevel,
    steps: [
      "Interpreting payment request…",
      "Extracting amount: $15.00",
      "Identifying recipient: Brew & Co.",
      "Checking location safety: Coffee shop (public)",
      "Evaluating spending rules: Routine expense",
      "Risk score: Very Low",
      "Auto-approving low-risk transaction…",
    ],
    context: [
      "Location: Downtown",
      "Time: Morning",
      "Frequent merchant: Coffee purchases 3x/week",
    ],
    policyChecks: [
      "Merchant is verified",
      "Amount typical for this merchant",
      "Location matches usual routine",
      "No suspicious activity",
    ],
    confidence: 97,
  },
  {
    command: "Transfer $200 to Marcus for rent",
    amount: "$200.00",
    recipient: "Marcus Chen",
    description: "Monthly rent contribution",
    riskLevel: "medium" as RiskLevel,
    steps: [
      "Interpreting payment request…",
      "Extracting amount: $200.00",
      "Identifying recipient: Marcus Chen",
      "Checking location safety: Home (safe zone)",
      "Evaluating spending rules: Rent category detected",
      "Risk score: Medium",
      "Decision pending approval…",
    ],
    context: [
      "Location: Home",
      "Time: Morning",
      "Recurring pattern: Monthly rent payment detected",
    ],
    policyChecks: [
      "Recipient is landlord/roommate",
      "Amount matches historical rent payments",
      "Transaction timing aligns with pattern",
      "Sufficient account balance",
    ],
    confidence: 88,
  },
];

export default function App() {
  const [state, setState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [currentScenario, setCurrentScenario] = useState(0);
  const [delayedPayment, setDelayedPayment] = useState<DelayedPayment | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const startVoiceCommand = async () => {
    if (state !== "idle" && state !== "completed") return;

    const scenario = mockScenarios[currentScenario % mockScenarios.length];
    setMessages([]);
    setState("listening");

    // Simulate voice input
    await delay(1500);

    // Processing states with AI thinking
    const stateProgression: Array<{ state: AppState; newMessages: string[] }> = [
      { state: "processing", newMessages: [] },
      { state: "understanding", newMessages: ["Interpreting payment request…"] },
      { state: "understanding", newMessages: ["Interpreting payment request…", `Extracting amount: ${scenario.amount}`] },
      { state: "understanding", newMessages: ["Interpreting payment request…", `Extracting amount: ${scenario.amount}`, `Identifying recipient: ${scenario.recipient}`] },
      { state: "evaluating", newMessages: [...scenario.steps.slice(0, 4)] },
      { state: "checking", newMessages: [...scenario.steps.slice(0, 5)] },
      { state: "deciding", newMessages: [...scenario.steps.slice(0, 6)] },
    ];

    for (const step of stateProgression) {
      await delay(800);
      setState(step.state);
      if (step.newMessages.length > messages.length) {
        setMessages(step.newMessages);
      }
    }

    // After deciding, check risk level
    await delay(800);
    
    if (scenario.riskLevel === "low") {
      // Auto-approve low risk
      setMessages(scenario.steps);
      setState("executing");
      await delay(1500);
      
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        command: scenario.command,
        amount: scenario.amount,
        recipient: scenario.recipient,
        description: scenario.description,
        confidence: scenario.confidence,
        context: scenario.context,
        policyChecks: scenario.policyChecks,
        decision: "approved",
        steps: scenario.steps,
      };

      setLogs([newLog, ...logs]);
      setState("completed");

      await delay(2000);
      setState("idle");
      setMessages([]);
      setCurrentScenario(currentScenario + 1);
    } else if (isBusy) {
      // User is busy, delay the payment
      setMessages([...scenario.steps.slice(0, -1), "User is busy, delaying payment for 30 seconds…"]);
      
      const delayedUntil = new Date();
      delayedUntil.setSeconds(delayedUntil.getSeconds() + 30);
      
      setDelayedPayment({
        id: Date.now().toString(),
        amount: scenario.amount,
        recipient: scenario.recipient,
        delayedUntil,
        scenario,
      });

      setState("completed");
      await delay(2000);
      setState("idle");
      setMessages([]);
      setCurrentScenario(currentScenario + 1);
    } else {
      // High/medium risk, need user approval
      setMessages(scenario.steps);
      setState("awaiting");
    }
  };

  const handleApprove = async () => {
    setState("executing");
    setMessages([...messages, "Approved by user", "Executing payment…", "Payment successful"]);

    await delay(2000);

    const scenario = mockScenarios[currentScenario % mockScenarios.length];
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      command: scenario.command,
      amount: scenario.amount,
      recipient: scenario.recipient,
      description: scenario.description,
      confidence: scenario.confidence,
      context: scenario.context,
      policyChecks: scenario.policyChecks,
      decision: "approved",
      steps: scenario.steps,
    };

    setLogs([newLog, ...logs]);
    setState("completed");

    await delay(2000);
    setState("idle");
    setMessages([]);
    setCurrentScenario(currentScenario + 1);
  };

  const handleDecline = async () => {
    setState("blocked");
    setMessages([...messages, "Declined by user", "Payment cancelled"]);

    await delay(2000);

    const scenario = mockScenarios[currentScenario % mockScenarios.length];
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      command: scenario.command,
      amount: scenario.amount,
      recipient: scenario.recipient,
      description: scenario.description,
      confidence: scenario.confidence,
      context: scenario.context,
      policyChecks: scenario.policyChecks,
      decision: "declined",
      steps: scenario.steps,
    };

    setLogs([newLog, ...logs]);
    setState("completed");

    await delay(2000);
    setState("idle");
    setMessages([]);
    setCurrentScenario(currentScenario + 1);
  };

  const handleWait = async () => {
    // Delay this payment
    const scenario = mockScenarios[currentScenario % mockScenarios.length];
    
    const delayedUntil = new Date();
    delayedUntil.setSeconds(delayedUntil.getSeconds() + 30);
    
    setDelayedPayment({
      id: Date.now().toString(),
      amount: scenario.amount,
      recipient: scenario.recipient,
      delayedUntil,
      scenario,
    });

    setState("idle");
    setMessages([]);
    setCurrentScenario(currentScenario + 1);
  };

  const handleDelayedTimeUp = async () => {
    if (!delayedPayment) return;

    setState("executing");
    setMessages(["Executing delayed payment…", "Payment successful"]);

    await delay(2000);

    const scenario = delayedPayment.scenario;
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      command: scenario.command,
      amount: scenario.amount,
      recipient: scenario.recipient,
      description: scenario.description,
      confidence: scenario.confidence,
      context: scenario.context,
      policyChecks: scenario.policyChecks,
      decision: "approved",
      steps: scenario.steps,
    };

    setLogs([newLog, ...logs]);
    setState("completed");

    await delay(2000);
    setState("idle");
    setMessages([]);
    setDelayedPayment(null);
  };

  const handleCancelDelayed = () => {
    if (!delayedPayment) return;

    const scenario = delayedPayment.scenario;
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      command: scenario.command,
      amount: scenario.amount,
      recipient: scenario.recipient,
      description: scenario.description,
      confidence: scenario.confidence,
      context: scenario.context,
      policyChecks: scenario.policyChecks,
      decision: "declined",
      steps: scenario.steps,
    };

    setLogs([newLog, ...logs]);
    setDelayedPayment(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white relative overflow-hidden">
      {/* Ambient background */}
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

      {/* Top center - Busy Mode Toggle */}
      <motion.div
        className="absolute top-6 left-1/2 -translate-x-1/2 z-30"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => setIsBusy(!isBusy)}
          className={`px-4 py-2 rounded-full backdrop-blur-xl border transition-all flex items-center gap-2 ${
            isBusy
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

      {/* Top right logs button */}
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

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12 gap-12">
        {/* Voice Orb */}
        <div
          onClick={state === "idle" || state === "completed" ? startVoiceCommand : undefined}
          className={state === "idle" || state === "completed" ? "cursor-pointer" : ""}
        >
          <VoiceOrb state={state} />
        </div>

        {/* AI Process Cloud */}
        <div className="w-full max-w-md">
          <AIProcessCloud messages={messages} isStreaming={state !== "idle" && state !== "completed"} />
        </div>

        {/* Decision Buttons */}
        <DecisionButtons
          show={state === "awaiting"}
          onApprove={handleApprove}
          onWait={handleWait}
          onDecline={handleDecline}
        />

        {/* Hint text for idle state */}
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
              <p className="text-xs text-white/20">Low risk: Auto-approved</p>
              <p className="text-xs text-white/20">High risk: Approval required</p>
              <p className="text-xs text-white/20">Busy mode: Delayed 30 seconds</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Logs Panel */}
      <LogsPanel logs={logs} isOpen={logsOpen} onClose={() => setLogsOpen(false)} />
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
