import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../../api/client';

interface User {
    id: number;
    username: string;
    email: string;
    balance: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    updateBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for stored token on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('caps_token');
        if (storedToken) {
            setToken(storedToken);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            fetchUser(storedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    const fetchUser = async (authToken: string) => {
        try {
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
            const response = await apiClient.get('/auth/me');
            console.log('Fetched user data:', response.data);
            setUser(response.data);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        const response = await apiClient.post('/auth/login', { username, password });
        const { token: newToken, user: userData } = response.data;

        setToken(newToken);
        setUser(userData);
        localStorage.setItem('caps_token', newToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const register = async (username: string, email: string, password: string) => {
        const response = await apiClient.post('/auth/register', { username, email, password });
        const { token: newToken, user: userData } = response.data;

        setToken(newToken);
        setUser(userData);
        localStorage.setItem('caps_token', newToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('caps_token');
        delete apiClient.defaults.headers.common['Authorization'];
    };

    const refreshUser = async () => {
        console.log('refreshUser called, token:', token ? 'exists' : 'null');
        if (token) {
            await fetchUser(token);
        }
    };

    const updateBalance = (newBalance: number) => {
        if (user) {
            console.log('Updating balance from', user.balance, 'to', newBalance);
            setUser({ ...user, balance: newBalance });
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
                refreshUser,
                updateBalance,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
