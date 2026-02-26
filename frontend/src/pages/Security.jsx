import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Security.css';

export default function Security() {
    const { user, setup2FA, verify2FA, fetchProfile } = useAuth();
    const [qrData, setQrData] = useState(null);
    const [code, setCode] = useState('');
    const [verified, setVerified] = useState(false);
    const [processing, setProcessing] = useState(false);

    const handleSetup = async () => {
        setProcessing(true);
        try {
            const data = await setup2FA();
            setQrData(data);
        } catch (err) {
            console.error('2FA setup failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await verify2FA(code);
            setVerified(true);
            setQrData(null);
            await fetchProfile();
        } catch (err) {
            console.error('2FA verify failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="page-container security-page fade-in">
            <div className="page-header">
                <h1>🔐 Security Settings</h1>
                <p>Manage your account security</p>
            </div>

            {/* Security Overview */}
            <div className="security-grid">
                <div className="security-card">
                    <div className="sec-header">
                        <h3>Account Protection</h3>
                    </div>
                    <div className="sec-checklist">
                        <div className="check-item done">
                            <span className="check-icon">✅</span>
                            <span>Password set (bcrypt hashed)</span>
                        </div>
                        <div className="check-item done">
                            <span className="check-icon">✅</span>
                            <span>JWT + refresh token rotation</span>
                        </div>
                        <div className="check-item done">
                            <span className="check-icon">✅</span>
                            <span>Device fingerprint binding</span>
                        </div>
                        <div className={`check-item ${user?.twoFactorEnabled ? 'done' : 'pending'}`}>
                            <span className="check-icon">{user?.twoFactorEnabled ? '✅' : '⚠️'}</span>
                            <span>Two-Factor Authentication</span>
                            {!user?.twoFactorEnabled && (
                                <span className="badge badge-warning" style={{ marginLeft: 'auto' }}>Recommended</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2FA Setup */}
                <div className="security-card">
                    <div className="sec-header">
                        <h3>Two-Factor Authentication</h3>
                        <span className={`badge ${user?.twoFactorEnabled ? 'badge-success' : 'badge-warning'}`}>
                            {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>

                    {user?.twoFactorEnabled ? (
                        <div className="twofa-enabled">
                            <p>🛡️ Your account is protected with TOTP-based 2FA. You'll need your authenticator app code every time you login.</p>
                        </div>
                    ) : verified ? (
                        <div className="twofa-success fade-in">
                            <span className="success-icon">🎉</span>
                            <h4>2FA Enabled Successfully!</h4>
                            <p>Your account is now more secure</p>
                        </div>
                    ) : qrData ? (
                        <div className="twofa-setup fade-in">
                            <p className="setup-instruction">Scan this QR code with your authenticator app:</p>
                            <img src={qrData.qrCode} alt="2FA QR Code" className="qr-code" />
                            <div className="manual-key">
                                <span>Manual key:</span>
                                <code>{qrData.secret}</code>
                            </div>
                            <form onSubmit={handleVerify} className="verify-form">
                                <div className="input-group">
                                    <label>Verification Code</label>
                                    <input
                                        type="text"
                                        placeholder="Enter 6-digit code"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        maxLength={6}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={processing || code.length < 6}>
                                    {processing ? 'Verifying...' : 'Verify & Enable'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="twofa-setup-prompt">
                            <p>Add an extra layer of security to your financial account. Required by most banking regulators.</p>
                            <button onClick={handleSetup} className="btn btn-primary" disabled={processing}>
                                {processing ? 'Setting up...' : 'Setup 2FA'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Session Info */}
            <div className="security-card" style={{ marginTop: 20 }}>
                <div className="sec-header">
                    <h3>Session Information</h3>
                </div>
                <div className="session-info">
                    <div className="session-row">
                        <span className="session-label">Email</span>
                        <span>{user?.email}</span>
                    </div>
                    <div className="session-row">
                        <span className="session-label">Role</span>
                        <span className="badge badge-info">{user?.role}</span>
                    </div>
                    <div className="session-row">
                        <span className="session-label">Account Created</span>
                        <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
