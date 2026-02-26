import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(false);

    const isAuthenticated = !!user;
    const isAdmin = user?.role === 'admin';

    // Persist user to localStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    // ─── Register ───
    const register = async (name, email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/register', { name, email, password });
            localStorage.setItem('accessToken', data.data.accessToken);
            setUser(data.data.user);
            toast.success('Account created — $1,000 credited!');
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Registration failed';
            toast.error(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // ─── Login ───
    const login = async (email, password) => {
        setLoading(true);
        try {
            const body = { email, password };

            const { data } = await api.post('/auth/login', body);
            localStorage.setItem('accessToken', data.data.accessToken);
            setUser(data.data.user);
            toast.success('Welcome back!');
            return data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed';
            toast.error(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // ─── Logout ───
    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Continue logout even if API call fails
        }
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
        toast.success('Logged out securely');
    };

    // ─── Fetch Profile ───
    const fetchProfile = useCallback(async () => {
        try {
            const { data } = await api.get('/profile');
            setUser(data.data);
            return data.data;
        } catch {
            return null;
        }
    }, []);

    // ─── Wallet: Get Balance ───
    const getBalance = async () => {
        const { data } = await api.get('/wallet/balance');
        return data.data;
    };

    // ─── Wallet: Transfer ───
    const transferMoney = async (recipientEmail, amount, description) => {
        try {
            const { data } = await api.post('/wallet/transfer', {
                recipientEmail,
                amount: parseFloat(amount),
                description,
            });
            if (data.data.transaction.status === 'flagged') {
                toast('Transfer flagged for review', { icon: '⚠️' });
            } else {
                toast.success(`$${amount} sent successfully!`);
            }
            return data.data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Transfer failed';
            toast.error(msg);
            throw err;
        }
    };

    // ─── Wallet: Deposit ───
    const depositMoney = async (amount) => {
        try {
            const { data } = await api.post('/wallet/deposit', {
                amount: parseFloat(amount),
            });
            toast.success(`$${amount} deposited!`);
            return data.data;
        } catch (err) {
            const msg = err.response?.data?.message || 'Deposit failed';
            toast.error(msg);
            throw err;
        }
    };

    // ─── Wallet: Transaction History ───
    const getTransactions = async (page = 1, limit = 20, type = null) => {
        const params = { page, limit };
        if (type) params.type = type;
        const { data } = await api.get('/wallet/transactions', { params });
        return data.data;
    };

    // ─── Admin: Get Users ───
    const getUsers = async () => {
        const { data } = await api.get('/admin/users');
        return data.data;
    };

    // ─── Admin: Force Logout ───
    const forceLogout = async (userId) => {
        const { data } = await api.post(`/admin/force-logout/${userId}`);
        toast.success(data.message);
        return data;
    };

    // ─── Admin: Flagged Transactions ───
    const getFlaggedTransactions = async () => {
        const { data } = await api.get('/wallet/flagged');
        return data.data;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthenticated,
                isAdmin,
                register,
                login,
                logout,
                fetchProfile,
                getBalance,
                transferMoney,
                depositMoney,
                getTransactions,
                getUsers,
                forceLogout,
                getFlaggedTransactions,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
