import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Admin.css';

export default function Admin() {
    const { getUsers, forceLogout, getFlaggedTransactions } = useAuth();
    const [users, setUsers] = useState([]);
    const [flagged, setFlagged] = useState([]);
    const [tab, setTab] = useState('users');
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersData, flaggedData] = await Promise.all([
                    getUsers(),
                    getFlaggedTransactions(),
                ]);
                setUsers(usersData.users);
                setFlagged(flaggedData.transactions);
            } catch (err) {
                console.error('Failed to load admin data:', err);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, []);

    const handleForceLogout = async (userId) => {
        if (!confirm('Force logout this user?')) return;
        try {
            await forceLogout(userId);
        } catch (err) {
            console.error('Force logout failed:', err);
        }
    };

    const formatAmount = (amt) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);

    const riskBadge = (score) => {
        if (score >= 70) return <span className="badge badge-danger">High ({score})</span>;
        if (score >= 50) return <span className="badge badge-warning">Medium ({score})</span>;
        return <span className="badge badge-success">Low ({score})</span>;
    };

    if (loadingData) {
        return (
            <div className="page-container">
                <div className="loading-state">Loading admin panel...</div>
            </div>
        );
    }

    return (
        <div className="page-container admin-page fade-in">
            <div className="page-header">
                <h1>⚙️ Admin Panel</h1>
                <p>User management and fraud monitoring</p>
            </div>

            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`tab ${tab === 'users' ? 'active' : ''}`}
                    onClick={() => setTab('users')}
                >
                    Users ({users.length})
                </button>
                <button
                    className={`tab ${tab === 'fraud' ? 'active' : ''}`}
                    onClick={() => setTab('fraud')}
                >
                    Fraud Monitor ({flagged.length})
                    {flagged.length > 0 && <span className="tab-alert">●</span>}
                </button>
            </div>

            {/* Users Table */}
            {tab === 'users' && (
                <div className="txn-table-wrapper">
                    <table className="txn-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Failed Logins</th>
                                <th>Joined</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u._id || u.id}>
                                    <td>{u.email}</td>
                                    <td>{u.name || '—'}</td>
                                    <td>
                                        <span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>{u.failedLoginAttempts || 0}</td>
                                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleForceLogout(u._id || u.id)}
                                        >
                                            Force Logout
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Fraud Monitor */}
            {tab === 'fraud' && (
                <>
                    {flagged.length === 0 ? (
                        <div className="empty-state">
                            <p>✅ No suspicious transactions detected</p>
                        </div>
                    ) : (
                        <div className="txn-table-wrapper">
                            <table className="txn-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Amount</th>
                                        <th>Risk Score</th>
                                        <th>Status</th>
                                        <th>Reference</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flagged.map((txn) => (
                                        <tr key={txn._id || txn.id} className={txn.riskScore >= 70 ? 'row-danger' : ''}>
                                            <td>
                                                {new Date(txn.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric',
                                                })}
                                            </td>
                                            <td>{txn.fromUser?.email || 'System'}</td>
                                            <td>{txn.toUser?.email || 'Unknown'}</td>
                                            <td className="txn-amt negative">{formatAmount(txn.amount)}</td>
                                            <td>{riskBadge(txn.riskScore)}</td>
                                            <td>
                                                <span className={`badge ${txn.status === 'flagged' ? 'badge-warning' : 'badge-success'}`}>
                                                    {txn.status}
                                                </span>
                                            </td>
                                            <td className="txn-ref">{txn.reference}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
