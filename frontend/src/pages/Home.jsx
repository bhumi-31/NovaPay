import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

export default function Home() {
    const { isAuthenticated } = useAuth();

    return (
        <div className="home">
            {/* Hero */}
            <section className="hero">
                <div className="hero-badge">🚀 Next-gen Digital Banking</div>
                <h1 className="hero-title">
                    Your Money,
                    <br />
                    <span className="gradient-text">Fortified.</span>
                </h1>
                <p className="hero-subtitle">
                    Send money instantly, track every transaction, and manage your
                    finances — all from one beautifully simple dashboard.
                </p>
                <div className="hero-actions">
                    {!isAuthenticated ? (
                        <>
                            <Link to="/register" className="btn btn-primary btn-lg">
                                Open Free Account
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </Link>
                            <Link to="/login" className="btn btn-secondary btn-lg">
                                Sign In
                            </Link>
                        </>
                    ) : (
                        <Link to="/dashboard" className="btn btn-primary btn-lg">
                            Go to Dashboard →
                        </Link>
                    )}
                </div>
                <div className="hero-stats">
                    <div className="stat">
                        <span className="stat-value">Instant</span>
                        <span className="stat-label">Transfers</span>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat">
                        <span className="stat-value">$1,000</span>
                        <span className="stat-label">Welcome Bonus</span>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat">
                        <span className="stat-value">24/7</span>
                        <span className="stat-label">Access</span>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="features">
                <h2 className="section-title">Everything You Need</h2>
                <p className="section-subtitle">Simple, powerful tools to manage your money with confidence</p>
                <div className="features-grid">
                    {[
                        { icon: '💸', title: 'Instant Transfers', desc: 'Send money to anyone with just their email. Funds arrive in seconds, not days.' },
                        { icon: '📊', title: 'Live Dashboard', desc: 'See your balance, spending trends, and recent activity at a glance.' },
                        { icon: '🔐', title: 'Two-Factor Auth', desc: 'Protect your account with an extra layer of security via authenticator app.' },
                        { icon: '📱', title: 'Transaction History', desc: 'Search, filter, and export your complete transaction history anytime.' },
                        { icon: '🛡️', title: 'Fraud Protection', desc: 'Built-in risk detection monitors every transaction to keep your money safe.' },
                        { icon: '💰', title: 'Free to Start', desc: 'Open your account in under a minute and get $1,000 to explore the platform.' },
                    ].map((f, i) => (
                        <div className="feature-card fade-in" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section">
                <div className="cta-card">
                    <h2>Ready to take control of your money?</h2>
                    <p>Join thousands of users who trust NovaPay for fast, secure payments.</p>
                    {!isAuthenticated ? (
                        <Link to="/register" className="btn btn-primary btn-lg">
                            Get Started — It's Free
                        </Link>
                    ) : (
                        <Link to="/dashboard" className="btn btn-primary btn-lg">
                            Open Dashboard
                        </Link>
                    )}
                </div>
            </section>
        </div>
    );
}
