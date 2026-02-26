import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Transactions.css';

export default function Transactions() {
    const { user, getTransactions } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [filter, setFilter] = useState('all');
    const [loadingData, setLoadingData] = useState(true);

    const fetchTxns = async (page = 1, type = null) => {
        setLoadingData(true);
        try {
            const data = await getTransactions(page, 15, type);
            setTransactions(data.transactions);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Failed to load transactions:', err);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        fetchTxns(1, filter === 'all' ? null : filter);
    }, [filter]);

    const formatAmount = (amt) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);

    const statusBadge = (status) => {
        const classes = {
            completed: 'badge-success',
            flagged: 'badge-warning',
            failed: 'badge-danger',
            pending: 'badge-info',
        };
        return <span className={`badge ${classes[status] || ''}`}>{status}</span>;
    };

    return (
        <div className="page-container txns-page fade-in">
            <div className="page-header">
                <h1>📊 Transaction History</h1>
                <p>{pagination.total} total transactions</p>
            </div>

            {/* Filters */}
            <div className="txn-filters">
                {['all', 'transfer', 'deposit'].map((f) => (
                    <button
                        key={f}
                        className={`btn btn-ghost btn-sm ${filter === f ? 'filter-active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loadingData ? (
                <div className="loading-state">Loading transactions...</div>
            ) : transactions.length === 0 ? (
                <div className="empty-state">No transactions found</div>
            ) : (
                <div className="txn-table-wrapper">
                    <table className="txn-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Details</th>
                                <th>Reference</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((txn) => {
                                const isSent = txn.fromUser?._id === user?.id || txn.fromUser === user?.id;
                                const isDeposit = txn.type === 'deposit';
                                return (
                                    <tr key={txn._id || txn.id}>
                                        <td className="txn-date">
                                            {new Date(txn.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                            <span className="txn-subtime">
                                                {new Date(txn.createdAt).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`type-badge ${txn.type}`}>
                                                {txn.type}
                                            </span>
                                        </td>
                                        <td>
                                            {isDeposit ? 'Account deposit' :
                                                isSent ? `To ${txn.toUser?.email || 'Unknown'}` :
                                                    `From ${txn.fromUser?.email || 'System'}`}
                                        </td>
                                        <td className="txn-ref">{txn.reference}</td>
                                        <td className={`txn-amt ${isDeposit || !isSent ? 'positive' : 'negative'}`}>
                                            {isDeposit || !isSent ? '+' : '-'}{formatAmount(txn.amount)}
                                        </td>
                                        <td>{statusBadge(txn.status)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="txn-pagination">
                    <button
                        className="btn btn-ghost btn-sm"
                        disabled={pagination.page <= 1}
                        onClick={() => fetchTxns(pagination.page - 1, filter === 'all' ? null : filter)}
                    >
                        ← Previous
                    </button>
                    <span className="page-info">
                        Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                        className="btn btn-ghost btn-sm"
                        disabled={pagination.page >= pagination.pages}
                        onClick={() => fetchTxns(pagination.page + 1, filter === 'all' ? null : filter)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
