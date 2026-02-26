import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './SendMoney.css';

export default function SendMoney() {
    const { transferMoney, depositMoney, loading } = useAuth();
    const [tab, setTab] = useState('send');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [result, setResult] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const data = await transferMoney(recipientEmail, amount, description);
            setResult(data);
            setRecipientEmail('');
            setAmount('');
            setDescription('');
        } catch (err) {
            console.error('Transfer failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const data = await depositMoney(depositAmount);
            setResult(data);
            setDepositAmount('');
        } catch (err) {
            console.error('Deposit failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const formatAmount = (amt) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amt);

    return (
        <div className="page-container send-page fade-in">
            <div className="page-header">
                <h1>💸 Transfer Money</h1>
                <p>Send money securely or add funds to your wallet</p>
            </div>

            {/* Tabs */}
            <div className="send-tabs">
                <button
                    className={`tab ${tab === 'send' ? 'active' : ''}`}
                    onClick={() => { setTab('send'); setResult(null); }}
                >
                    Send Money
                </button>
                <button
                    className={`tab ${tab === 'deposit' ? 'active' : ''}`}
                    onClick={() => { setTab('deposit'); setResult(null); }}
                >
                    Deposit
                </button>
            </div>

            {/* Success Result */}
            {result && (
                <div className="result-card fade-in">
                    <div className="result-icon">✅</div>
                    <h3>{tab === 'send' ? 'Transfer Complete' : 'Deposit Complete'}</h3>
                    <p className="result-amount">{formatAmount(result.transaction.amount)}</p>
                    <p className="result-ref">Ref: {result.transaction.reference}</p>
                    <p className="result-balance">New Balance: {formatAmount(result.newBalance)}</p>
                    {result.transaction.status === 'flagged' && (
                        <div className="badge badge-warning" style={{ margin: '8px auto' }}>Flagged for review</div>
                    )}
                    <button className="btn btn-secondary" onClick={() => setResult(null)}>
                        New Transfer
                    </button>
                </div>
            )}

            {/* Send Form */}
            {!result && tab === 'send' && (
                <form onSubmit={handleSend} className="send-form card">
                    <div className="input-group">
                        <label>Recipient Email</label>
                        <input
                            type="email"
                            placeholder="recipient@example.com"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <label>Amount (USD)</label>
                        <div className="amount-input-wrapper">
                            <span className="currency-prefix">$</span>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min="0.01"
                                max="50000"
                                step="0.01"
                                required
                            />
                        </div>
                        {amount > 2000 && (
                            <span className="input-hint" style={{ color: 'var(--warning)' }}>
                                ⚠️ Large transfers may be flagged for review
                            </span>
                        )}
                    </div>

                    <div className="input-group">
                        <label>Description (optional)</label>
                        <input
                            type="text"
                            placeholder="What's this for?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={200}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={processing}>
                        {processing ? 'Processing...' : `Send ${amount ? formatAmount(amount) : ''}`}
                    </button>
                </form>
            )}

            {/* Deposit Form */}
            {!result && tab === 'deposit' && (
                <form onSubmit={handleDeposit} className="send-form card">
                    <div className="input-group">
                        <label>Deposit Amount (USD)</label>
                        <div className="amount-input-wrapper">
                            <span className="currency-prefix">$</span>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                min="1"
                                max="10000"
                                step="0.01"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="quick-amounts">
                        {[50, 100, 250, 500, 1000].map((val) => (
                            <button
                                type="button"
                                key={val}
                                className="btn btn-ghost btn-sm"
                                onClick={() => setDepositAmount(val.toString())}
                            >
                                ${val}
                            </button>
                        ))}
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={processing}>
                        {processing ? 'Processing...' : `Deposit ${depositAmount ? formatAmount(depositAmount) : ''}`}
                    </button>
                </form>
            )}
        </div>
    );
}
