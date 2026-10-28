import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ household }) {
  const { user, logout } = useAuth();

  return (
    <nav style={{ 
      background: 'rgba(15, 23, 42, 0.7)', 
      backdropFilter: 'blur(12px)', 
      borderBottom: '1px solid rgba(255,255,255,0.1)', 
      padding: '1rem 2rem', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🛒 SyncCart
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {household && (
          <div style={{ fontSize: '0.875rem', color: '#CBD5E1' }}>
            Household: <strong style={{color:'white', letterSpacing: '0.5px'}}>{household.name}</strong> 
            <span style={{opacity: 0.7, marginLeft: '4px'}}>({household.joinCode})</span>
          </div>
        )}
        <span style={{ 
          background: 'var(--primary-green)', 
          color: 'white', 
          padding: '0.25rem 0.75rem', 
          borderRadius: '20px', 
          fontSize: '0.75rem', 
          fontWeight: 600, 
          textTransform: 'uppercase' 
        }}>
          {user?.role || 'User'}
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
          {user?.name}
        </span>
        <button onClick={logout} style={{ 
          background: 'rgba(239, 68, 68, 0.15)', 
          color: '#FCA5A5', 
          border: '1px solid rgba(239, 68, 68, 0.3)', 
          padding: '0.4rem 1rem', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          fontWeight: 600, 
          fontSize: '0.85rem',
          transition: 'all 0.2s ease'
        }}
        onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.25)'}
        onMouseOut={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.15)'}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}