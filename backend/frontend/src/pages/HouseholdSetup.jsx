import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function HouseholdSetup({ onHouseholdJoined }) {
  const [activeTab, setActiveTab] = useState('join');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await API.post('/households/create', { name });
      const updatedHousehold = response.data;

      const updatedUser = { ...user, householdId: updatedHousehold._id, role: 'admin' };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      onHouseholdJoined(updatedHousehold);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create household');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await API.post('/households/join', { joinCode });
      const updatedHousehold = response.data;

      const updatedUser = { ...user, householdId: updatedHousehold._id, role: 'member' };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      onHouseholdJoined(updatedHousehold);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join household');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grocery-theme-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-card" style={{ maxWidth: '480px', width: '100%' }}>
        <h2>Welcome, {user?.name}! 👋</h2>
        <p className="subtitle">Join your roommates or family to start syncing groceries in real time.</p>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <button
            className={activeTab === 'join' ? 'btn-primary' : 'btn-primary'}
            style={{
              flex: 1,
              marginTop: 0,
              background: activeTab === 'join' ? 'var(--primary-green)' : 'rgba(255, 255, 255, 0.1)',
              border: activeTab === 'join' ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'
            }}
            onClick={() => setActiveTab('join')}
          >
            Join Existing
          </button>
          <button
            className={activeTab === 'create' ? 'btn-primary' : 'btn-primary'}
            style={{
              flex: 1,
              marginTop: 0,
              background: activeTab === 'create' ? 'var(--primary-green)' : 'rgba(255, 255, 255, 0.1)',
              border: activeTab === 'create' ? 'none' : '1px solid rgba(255, 255, 255, 0.2)'
            }}
            onClick={() => setActiveTab('create')}
          >
            Create New
          </button>
        </div>

        {activeTab === 'join' ? (
          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label>Household Join Code</label>
              <input
                type="text"
                placeholder="e.g. CART-WJ53XN"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Joining...' : 'Join Household'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Household Name</label>
              <input
                type="text"
                placeholder="e.g. Apartment 4B"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Household'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}