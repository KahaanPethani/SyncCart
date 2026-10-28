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

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const result = await register(name, email, password);
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
        <Typewriter text="  Get your household in sync." />
        <p className="hero-subtext">
          Join thousands of households eliminating food waste, sharing expenses, and organizing their shopping lists in real time.
        </p>
      </div>

      {/* Right Side: Integrated Glassmorphism Register Card */}
      <div className="glass-form-section">
        <div className="glass-card">
          <h2>Make an account today</h2>
          <p className="subtitle">Start managing your shared inventory.</p>

          {errorMessage && <div className="error-banner">{errorMessage}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Alex Smith"
              />
            </div>

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
                minLength={6}
                placeholder="Must be at least 6 characters"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="auth-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}