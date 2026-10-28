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

    const priceInput = window.prompt('Total price paid? (Leave blank to skip)');
    if (priceInput === null) return;

    let parsedPrice = 0;
    if (priceInput.trim() !== '') {
      const num = parseFloat(priceInput);
      if (isNaN(num) || num < 0) {
        alert('Please enter a valid positive price number.');
        return;
      }
      parsedPrice = num;
    }

    try {
      const res = await API.patch(`/items/${item._id}/status`, {
        status: 'pantry',
        boughtQuantity: boughtQty,
        price: parsedPrice,
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

  // Ledger Calculations
  const members = household?.members || [];
  const memberCount = Math.max(members.length, 1);

  // 1. Total Household Spend (sum of all pantry item prices)
  const totalSpend = pantryItems.reduce((acc, item) => acc + (Number(item.price) || 0), 0);

  // 2. Fair Share per Member
  const fairShare = members.length > 0 ? totalSpend / memberCount : 0;

  // 3. Member contributions (Total Paid by each member and individual balance)
  const memberContributions = members.map((member) => {
    const memberId = String(member._id);
    const paid = pantryItems.reduce((sum, item) => {
      const payerId = String(
        (typeof item.boughtBy === 'object' ? item.boughtBy?._id : item.boughtBy) ||
        (typeof item.addedBy === 'object' ? item.addedBy?._id : item.addedBy) ||
        ''
      );
      return payerId === memberId ? sum + (Number(item.price) || 0) : sum;
    }, 0);

    const balance = paid - fairShare;

    return {
      _id: memberId,
      name: member.name || member.email || 'Member',
      paid,
      balance,
    };
  });

  // 4. Calculate who owes whom (debt settlement minimization)
  const debts = [];
  const debtors = memberContributions
    .filter((m) => m.balance < -0.01)
    .map((m) => ({ name: m.name, amount: -m.balance }));
  const creditors = memberContributions
    .filter((m) => m.balance > 0.01)
    .map((m) => ({ name: m.name, amount: m.balance }));

  let debtorIdx = 0;
  let creditorIdx = 0;
  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];
    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) {
      debts.push({
        from: debtor.name,
        to: creditor.name,
        amount: settleAmount.toFixed(2),
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount <= 0.01) debtorIdx++;
    if (creditor.amount <= 0.01) creditorIdx++;
  }

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

        {/* 💸 Full-Width Monthly Ledger Glass Card */}
        <div className="glass-card" style={{ maxWidth: '100%', padding: '1.75rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💸</span>
              <h3 style={{ fontSize: '1.35rem', color: 'white', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
                Monthly Ledger
              </h3>
            </div>
            <span style={{ 
              background: 'rgba(16, 185, 129, 0.15)', 
              color: '#34D399', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              padding: '0.3rem 0.8rem', 
              borderRadius: '20px', 
              fontSize: '0.8rem', 
              fontWeight: 600,
              letterSpacing: '0.3px'
            }}>
              Fair-Share Split ({memberCount} {memberCount === 1 ? 'Member' : 'Members'})
            </span>
          </div>

          {/* Metric Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '1.1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginBottom: '0.35rem' }}>TOTAL HOUSEHOLD SPEND</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>${totalSpend.toFixed(2)}</div>
            </div>
            <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '1.1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginBottom: '0.35rem' }}>FAIR SHARE / PERSON</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34D399', letterSpacing: '-0.02em' }}>${fairShare.toFixed(2)}</div>
            </div>
            <div style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '1.1rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 500, marginBottom: '0.35rem' }}>PANTRY ITEMS LOGGED</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>{pantryItems.length}</div>
            </div>
          </div>

          {/* Member Balances Breakdown */}
          {members.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                Member Contributions & Balances
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {memberContributions.map((m) => {
                  const isCreditor = m.balance > 0.01;
                  const isDebtor = m.balance < -0.01;
                  return (
                    <div key={m._id} style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      borderRadius: '12px', 
                      padding: '0.85rem 1rem', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <div>
                        <strong style={{ color: 'white', fontSize: '0.95rem' }}>{m.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.15rem' }}>Paid: ${m.paid.toFixed(2)}</div>
                      </div>
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: '0.85rem',
                        color: isCreditor ? '#34D399' : isDebtor ? '#F87171' : '#94A3B8',
                        background: isCreditor ? 'rgba(16, 185, 129, 0.12)' : isDebtor ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '8px'
                      }}>
                        {isCreditor ? `+ $${m.balance.toFixed(2)}` : isDebtor ? `- $${Math.abs(m.balance).toFixed(2)}` : 'Settled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settlements / Who Owes Whom */}
          <div>
            <h4 style={{ fontSize: '0.85rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
              Settlement Summary
            </h4>
            {debts.length === 0 ? (
              <div style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1px solid rgba(16, 185, 129, 0.25)', 
                color: '#A7F3D0', 
                padding: '0.85rem 1rem', 
                borderRadius: '12px', 
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                ✨ All balances are settled up! Everyone has contributed their fair share.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {debts.map((debt, idx) => (
                  <div key={idx} style={{ 
                    background: 'rgba(0, 0, 0, 0.3)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    borderRadius: '10px', 
                    padding: '0.75rem 1rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    color: 'white',
                    fontSize: '0.95rem'
                  }}>
                    <div>
                      <strong style={{ color: '#F87171' }}>{debt.from}</strong> owes <strong style={{ color: '#34D399' }}>{debt.to}</strong>
                    </div>
                    <span style={{ 
                      background: 'rgba(248, 113, 113, 0.15)', 
                      color: '#FCA5A5', 
                      border: '1px solid rgba(248, 113, 113, 0.3)', 
                      padding: '0.2rem 0.6rem', 
                      borderRadius: '8px', 
                      fontWeight: 700, 
                      fontSize: '0.9rem' 
                    }}>
                      ${debt.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              pantryItems.map((item) => {
                const itemPrice = Number(item.price) || 0;
                const buyerName = item.boughtBy?.name || members.find(m => String(m._id) === String(item.boughtBy || item.addedBy))?.name;
                return (
                  <div key={item._id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <span style={{ textDecoration: 'line-through', fontSize: '1.1rem' }}>{item.name}</span> 
                      <span style={{ fontWeight: 600, marginLeft: '0.5rem', color: '#94A3B8' }}>x{item.quantity}</span>
                      {itemPrice > 0 && (
                        <span style={{ 
                          marginLeft: '0.6rem', 
                          background: 'rgba(16, 185, 129, 0.15)', 
                          color: '#34D399', 
                          border: '1px solid rgba(16, 185, 129, 0.3)', 
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '6px', 
                          fontSize: '0.8rem', 
                          fontWeight: 600 
                        }}>
                          ${itemPrice.toFixed(2)}
                        </span>
                      )}
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#94A3B8' }}>
                        {item.category} {buyerName ? `• Paid by ${buyerName}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleMoveToCart(item)} className="btn-primary" style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.15)' }}>Move to Cart ↺</button>
                      <button onClick={() => deleteItem(item._id)} style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>✕</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </main>
    </div>
  );
}