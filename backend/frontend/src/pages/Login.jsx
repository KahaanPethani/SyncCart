import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Typewriter = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 45);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <div className="typewriter-container">
      {displayedText}
      <span className="cursor">&nbsp;</span>
    </div>
  );
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="grocery-theme-layout">
      {/* Left Side: Clean Floating Text over Supermarket Image */}
      <div className="hero-text-section">
        <div className="brand-title">🛒 SyncCart</div>
        <Typewriter text="Never double-buy groceries again." />
        <p className="hero-subtext">
          Real-time household inventory syncing. Keep your pantry stocked and your household on the same page.
        </p>
      </div>

      {/* Right Side: Integrated Glassmorphism Login Card */}
      <div className="glass-form-section">
        <div className="glass-card">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to access your household cart.</p>

          {errorMessage && <div className="error-banner">{errorMessage}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-link">
            Don't have an account? <Link to="/register">Create one now</Link>
          </div>
        </div>
      </div>
    </div>
  );
}