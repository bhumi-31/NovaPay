import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
    const { user, getBalance, getTransactions } = useAuth();
    const [wallet, setWallet] = useState(null);
    const [recentTxns, setRecentTxns] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [walletData, txnData] = await Promise.all([
                    getBalance(),
                    getTransactions(1, 5),
                ]);
                setWallet(walletData);
                setRecentTxns(txnData.transactions);
            } catch (err) {
                console.error('Failed to load dashboard:', err);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, []);

    const formatAmount = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    if (loadingData) {
        return (
            <div className="page-container">
                <div className="loading-state">Loading your wallet...</div>
            </div>
        );
    }

    return (
        <div className="page-container dashboard fade-in">
            {/* Greeting */}
            <div className="dash-greeting">
                <h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name || 'there'}</h1>
                <p>Here's your financial overview</p>
            </div>

            {/* Balance Card */}
            <div className="balance-card">
                <div className="balance-left">
                    <span className="balance-label">Available Balance</span>
                    <h2 className="balance-amount">{wallet ? formatAmount(wallet.balance) : '$0.00'}</h2>
                    <span className="balance-currency">{wallet?.currency || 'USD'}</span>
                </div>
                <div className="balance-right">
                    <Link to="/send" className="btn btn-primary">
                        Send Money →
                    </Link>
                    <Link to="/transactions" className="btn btn-secondary">
                        View History
                    </Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon sent">↗</div>
                    <div>
                        <span className="stat-label">Total Sent</span>
                        <span className="stat-value">{wallet ? formatAmount(wallet.totalSent) : '$0.00'}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon received">↙</div>
                    <div>
                        <span className="stat-label">Total Received</span>
                        <span className="stat-value">{wallet ? formatAmount(wallet.totalReceived) : '$0.00'}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon security">🛡️</div>
                    <div>
                        <span className="stat-label">Security</span>
                        <span className="stat-value">{user?.twoFactorEnabled ? '2FA On' : '2FA Off'}</span>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="recent-section">
                <div className="section-header">
                    <h3>Recent Transactions</h3>
                    <Link to="/transactions" className="btn btn-ghost btn-sm">View All →</Link>
                </div>
                {recentTxns.length === 0 ? (
                    <div className="empty-state">
                        <p>No transactions yet. <Link to="/send">Send your first payment!</Link></p>
                    </div>
                ) : (
                    <div className="txn-list">
                        {recentTxns.map((txn) => {
                            const isSent = txn.fromUser?._id === user?.id || txn.fromUser === user?.id;
                            const isDeposit = txn.type === 'deposit';
                            return (
                                <div className="txn-row" key={txn._id || txn.id}>
                                    <div className="txn-icon-wrap">
                                        <span className={`txn-icon ${isDeposit ? 'deposit' : isSent ? 'sent' : 'received'}`}>
                                            {isDeposit ? '💰' : isSent ? '↗' : '↙'}
                                        </span>
                                    </div>
                                    <div className="txn-details">
                                        <span className="txn-desc">
                                            {isDeposit ? 'Deposit' : isSent ? `To ${txn.toUser?.email || 'Unknown'}` : `From ${txn.fromUser?.email || 'System'}`}
                                        </span>
                                        <span className="txn-time">
                                            {new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="txn-amount-wrap">
                                        <span className={`txn-amount ${isDeposit || !isSent ? 'positive' : 'negative'}`}>
                                            {isDeposit || !isSent ? '+' : '-'}{formatAmount(txn.amount)}
                                        </span>
                                        {txn.status === 'flagged' && <span className="badge badge-warning">Flagged</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <Link to="/send" className="action-card">
                    <span className="action-icon">💸</span>
                    <span>Send Money</span>
                </Link>
                <Link to="/security" className="action-card">
                    <span className="action-icon">🔐</span>
                    <span>Security</span>
                </Link>
                <Link to="/transactions" className="action-card">
                    <span className="action-icon">📊</span>
                    <span>History</span>
                </Link>
            </div>
        </div>
    );
}
