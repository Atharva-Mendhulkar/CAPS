import { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from './AuthContext';

interface RegisterProps {
    onSwitchToLogin: () => void;
}

export function Register({ onSwitchToLogin }: RegisterProps) {
    const { register } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            await register(username, email, password);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto"
        >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Create Account</h1>
                    <p className="text-white/60 mt-2">Join CAPS and start transacting</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 transition-colors"
                            placeholder="Choose a username"
                            required
                            minLength={3}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 transition-colors"
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 transition-colors pr-12"
                                placeholder="At least 6 characters"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-green-500 transition-colors pr-12"
                                placeholder="Repeat your password"
                                required
                            />
                            {confirmPassword && password === confirmPassword && (
                                <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                            )}
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Creating account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-white/60">
                        Already have an account?{' '}
                        <button
                            onClick={onSwitchToLogin}
                            className="text-green-400 hover:text-green-300 font-medium"
                        >
                            Sign in
                        </button>
                    </p>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/40 text-center">
                        You'll receive ₹1,000 starting balance to test payments
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
