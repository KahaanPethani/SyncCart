import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import socket from '../api/socket';
import Navbar from '../components/Navbar';
import HouseholdSetup from './HouseholdSetup';

export default function Dashboard() {
  const { user } = useAuth();
  const [household, setHousehold] = useState(null);
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [category, setCategory] = useState('Produce');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentHouseholdId = user?.householdId || household?._id;
    if (!currentHouseholdId) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const [houseRes, itemsRes] = await Promise.all([
          API.get('/households/my-household'),
          API.get('/items'),
        ]);
        setHousehold(houseRes.data);
        setItems(itemsRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.householdId, household?._id]);

  useEffect(() => {
    const householdId = user?.householdId || household?._id;
    if (!householdId) return;

    socket.connect();
    socket.emit('JOIN_HOUSEHOLD', householdId.toString());

    socket.on('ITEM_ADDED', (newItem) => {
      setItems((prev) => prev.some(i => i._id === newItem._id) ? prev : [newItem, ...prev]);
    });
    socket.on('ITEM_UPDATED', (updatedItem) => {
      setItems((prev) => prev.map(i => i._id === updatedItem._id ? updatedItem : i));
    });
    socket.on('ITEM_DELETED', ({ itemId }) => {
      setItems((prev) => prev.filter(i => i._id !== itemId));
    });

    return () => {
      socket.off('ITEM_ADDED');
      socket.off('ITEM_UPDATED');
      socket.off('ITEM_DELETED');
    };
  }, [user, household]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await API.post('/items', { name, quantity: parseInt(quantity), category, status: 'cart' });
      setItems((prev) => prev.some(i => i._id === res.data._id) ? prev : [res.data, ...prev]);
      setName('');
      setQuantity(1);
    } catch (err) {
      alert('Failed to add item');
    }
  };

  const handleBuyItem = async (item) => {
    let boughtQty = item.quantity;

    if (item.quantity > 1) {
      const input = window.prompt(
        `How many ${item.name} did you buy? (1 - ${item.quantity})`,
        item.quantity
      );
      
      // User pressed Cancel
      if (input === null) return;

      boughtQty = parseInt(input, 10);
      if (isNaN(boughtQty) || boughtQty < 1 || boughtQty > item.quantity) {
        alert('Please enter a valid quantity within range.');
        return;
      }
    }

    try {
      const res = await API.patch(`/items/${item._id}/status`, {
        status: 'pantry',
        boughtQuantity: boughtQty,
      });

      const data = res.data;

      setItems((prev) => {
        if (data.split) {
          // Update the existing cart item with reduced quantity & add the new pantry item
          const updatedList = prev.map((i) =>
            i._id === data.updatedCartItem._id ? data.updatedCartItem : i
          );

          // Prevent duplicate if socket also added it
          if (updatedList.some((i) => i._id === data.newPantryItem._id)) {
            return updatedList;
          }
          return [data.newPantryItem, ...updatedList];
        } else {
          // Full buy: simply update item status
          return prev.map((i) => (i._id === data.item._id ? data.item : i));
        }
      });
    } catch (err) {
      console.error('Failed to move item to pantry:', err);
      alert(err.response?.data?.error || 'Failed to move item to pantry');
    }
  };

  const handleMoveToCart = async (item) => {
    try {
      const res = await API.patch(`/items/${item._id}/status`, {
        status: 'cart',
      });
      const updatedItem = res.data.item || res.data;

      setItems((prev) =>
        prev.map((i) => (i._id === updatedItem._id ? updatedItem : i))
      );
    } catch (err) {
      console.error('Failed to move item to cart:', err);
      alert('Failed to return item to cart');
    }
  };

  const deleteItem = async (id) => {
    try {
      await API.delete(`/items/${id}`);
      setItems((prev) => prev.filter(i => i._id !== id));
    } catch (err) {
      alert('Failed to delete item');
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>Loading SyncCart...</div>;
  if (!user?.householdId && !household) return <HouseholdSetup onHouseholdJoined={(h) => setHousehold(h)} />;

  const cartItems = items.filter(i => i.status === 'cart');
  const pantryItems = items.filter(i => i.status === 'pantry');

  return (
    <div className="grocery-theme-layout" style={{ display: 'block', minHeight: '100vh', backgroundAttachment: 'fixed' }}>
      <Navbar household={household} />

      {/* Confined main content to prevent full-screen stretching */}
      <main style={{ zIndex: 1, position: 'relative', maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        
        {/* Sleek inline Add Form */}
        <div className="glass-card" style={{ maxWidth: '100%', padding: '1.25rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'white', margin: 0, whiteSpace: 'nowrap' }}>➕ Add Item:</h3>
          <form onSubmit={handleAddItem} style={{ display: 'flex', flex: 1, gap: '0.75rem', alignItems: 'center' }}>
            <input type="text" placeholder="e.g. Apples" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 2, margin: 0, padding: '0.75rem' }} />
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '80px', margin: 0, padding: '0.75rem' }} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', outline: 'none' }}>
              <option value="Produce" style={{color: 'black'}}>Produce</option>
              <option value="Dairy" style={{color: 'black'}}>Dairy</option>
              <option value="Meat" style={{color: 'black'}}>Meat</option>
              <option value="Pantry" style={{color: 'black'}}>Pantry</option>
              <option value="Household" style={{color: 'black'}}>Household</option>
              <option value="Other" style={{color: 'black'}}>Other</option>
            </select>
            <button type="submit" className="btn-primary" style={{ margin: 0, padding: '0.75rem 1.5rem', width: 'auto' }}>Add to Cart</button>
          </form>
        </div>

        {/* Structured Columns Container */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          
          {/* Cart Column Frame */}
          <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.4)' }}>
            <h3 style={{ marginBottom: '1.25rem', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
              🛒 Needed in Cart ({cartItems.length})
            </h3>
            {cartItems.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '1rem' }}>Cart is empty! All items are stocked.</p>
            ) : (
              cartItems.map((item) => (
                <div key={item._id} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'white' }}>
                    <strong style={{fontSize: '1.1rem'}}>{item.name}</strong> <span style={{ color: '#94A3B8', fontWeight: 600, marginLeft: '0.5rem' }}>x{item.quantity}</span>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>{item.category}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleBuyItem(item)} className="btn-primary" style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Bought ✓</button>
                    <button onClick={() => deleteItem(item._id)} style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pantry Column Frame */}
          <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.4)' }}>
            <h3 style={{ marginBottom: '1.25rem', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
              📦 In Pantry ({pantryItems.length})
            </h3>
            {pantryItems.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '1rem' }}>No items in pantry yet.</p>
            ) : (
              pantryItems.map((item) => (
                <div key={item._id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ textDecoration: 'line-through', fontSize: '1.1rem' }}>{item.name}</span> <span style={{ fontWeight: 600, marginLeft: '0.5rem' }}>x{item.quantity}</span>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{item.category}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleMoveToCart(item)} className="btn-primary" style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)' }}>Move to Cart ↺</button>
                    <button onClick={() => deleteItem(item._id)} style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </main>
    </div>
  );
}