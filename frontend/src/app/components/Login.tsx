import { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

interface LoginProps {
    onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Login failed. Please try again.');
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
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Welcome to CAPS</h1>
                    <p className="text-white/60 mt-2">Sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Enter your username"
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
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors pr-12"
                                placeholder="Enter your password"
                                required
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
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-white/60">
                        Don't have an account?{' '}
                        <button
                            onClick={onSwitchToRegister}
                            className="text-purple-400 hover:text-purple-300 font-medium"
                        >
                            Create one
                        </button>
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
