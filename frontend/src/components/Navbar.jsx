import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
    const { isAuthenticated, isAdmin, user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <Link to="/" className="nav-brand">
                <div className="brand-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#g1)" />
                        <path d="M2 17l10 5 10-5" stroke="url(#g1)" strokeWidth="2" fill="none" />
                        <path d="M2 12l10 5 10-5" stroke="url(#g1)" strokeWidth="2" fill="none" />
                        <defs>
                            <linearGradient id="g1" x1="2" y1="2" x2="22" y2="22">
                                <stop stopColor="#10b981" />
                                <stop offset="1" stopColor="#06b6d4" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <span className="brand-text">
                    Nova<span className="brand-accent">Pay</span>
                </span>
            </Link>

            <div className="nav-links">
                {!isAuthenticated ? (
                    <>
                        <Link to="/login" className="nav-link">Sign In</Link>
                        <Link to="/register" className="nav-link nav-cta">Get Started</Link>
                    </>
                ) : (
                    <>
                        <Link to="/dashboard" className="nav-link">Dashboard</Link>
                        <Link to="/send" className="nav-link">Send</Link>
                        <Link to="/transactions" className="nav-link">History</Link>
                        {isAdmin && <Link to="/admin" className="nav-link nav-admin">Admin</Link>}
                        <div className="nav-user-section">
                            <span className="nav-avatar">{user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                            <button onClick={handleLogout} className="nav-logout-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </nav>
    );
}
