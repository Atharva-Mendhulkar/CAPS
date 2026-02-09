import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from './AuthContext';

interface Transaction {
    id: number;
    transaction_id: string;
    sender_id: number;
    receiver_id: number;
    sender_username: string;
    receiver_username: string;
    amount: number;
    status: string;
    created_at: string;
    completed_at: string;
}

interface TransactionHistoryProps {
    isOpen: boolean;
    onClose: () => void;
}

export function TransactionHistory({ isOpen, onClose }: TransactionHistoryProps) {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/transactions');
            setTransactions(response.data.transactions || []);
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchTransactions();
    }, [isOpen]);

    const filtered = transactions.filter((txn) => {
        if (filter === 'sent') return txn.sender_id === user?.id;
        if (filter === 'received') return txn.receiver_id === user?.id;
        return true;
    });

    const isSent = (txn: Transaction) => txn.sender_id === user?.id;

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
                        onClick={onClose}
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
                                <h2 className="text-xl font-light text-white/90">Transaction History</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchTransactions}
                                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                                        title="Refresh"
                                    >
                                        <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center"
                                    >
                                        <X className="w-5 h-5 text-white/60" />
                                    </button>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex gap-1 p-4 pb-0">
                                {(['all', 'sent', 'received'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === f
                                                ? f === 'sent'
                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                    : f === 'received'
                                                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {f === 'all' ? 'All' : f === 'sent' ? '↑ Sent' : '↓ Received'}
                                    </button>
                                ))}
                            </div>

                            {/* Transaction List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loading ? (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="flex items-center justify-center h-32">
                                        <p className="text-white/40 text-sm">No transactions found</p>
                                    </div>
                                ) : (
                                    filtered.map((txn) => {
                                        const sent = isSent(txn);
                                        const date = new Date(txn.completed_at || txn.created_at);
                                        return (
                                            <motion.div
                                                key={txn.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-10 h-10 rounded-full flex items-center justify-center ${sent
                                                                    ? 'bg-red-500/20 border border-red-500/30'
                                                                    : 'bg-green-500/20 border border-green-500/30'
                                                                }`}
                                                        >
                                                            {sent ? (
                                                                <ArrowUpRight className="w-5 h-5 text-red-400" />
                                                            ) : (
                                                                <ArrowDownLeft className="w-5 h-5 text-green-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-white/90">
                                                                {sent ? `Sent to ${txn.receiver_username}` : `Received from ${txn.sender_username}`}
                                                            </p>
                                                            <p className="text-xs text-white/40">
                                                                {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p
                                                            className={`text-lg font-semibold ${sent ? 'text-red-400' : 'text-green-400'
                                                                }`}
                                                        >
                                                            {sent ? '-' : '+'}₹{txn.amount.toFixed(2)}
                                                        </p>
                                                        <p className="text-xs text-white/30">{txn.status}</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
