import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'AD-';
  for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  key += '-';
  for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

export default function AdminPanel() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [licenses, setLicenses] = useState([]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [newCustomer, setNewCustomer] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchLicenses();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchLicenses();
    });
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function fetchLicenses() {
    const { data, error } = await supabase.from('licenses').select('*').order('created_at', { ascending: false });
    if (error) console.error("Error fetching licenses:", error);
    else setLicenses(data);
  }

  async function createLicense(e) {
    e.preventDefault();
    const key = generateKey();
    const { error } = await supabase.from('licenses').insert([{
      license_key: key,
      customer_name: newCustomer,
    }]);
    if (error) alert("Error: " + error.message);
    else {
      setNewCustomer('');
      fetchLicenses();
    }
  }

  async function unbindDevice(id) {
    const { error } = await supabase.from('licenses').update({ device_id: null, activated_at: null }).eq('id', id);
    if (error) alert(error.message);
    else fetchLicenses();
  }

  async function toggleStatus(id, currentStatus) {
    const { error } = await supabase.from('licenses').update({ is_active: !currentStatus }).eq('id', id);
    if (error) alert(error.message);
    else fetchLicenses();
  }

  if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Loading Admin Panel...</div>;

  if (!session) {
    return (
      <div className="activation-container glass-container" style={{ width: '100vw', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="activation-card glass-panel" style={{ padding: '2rem', width: '400px', maxWidth: '90%' }}>
          <h2>Admin Login</h2>
          {authError && <div style={{ color: '#ff4d4d', marginBottom: '1rem' }}>{authError}</div>}
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Email" className="glass-input" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem' }} />
            <input type="password" placeholder="Password" className="glass-input" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem' }} />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>Login</button>
          </form>
          <p style={{ marginTop: '1rem', opacity: 0.6, fontSize: '0.8rem', textAlign: 'center' }}>
            Note: You must create your admin account manually in the Supabase Dashboard (Auth tab) first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', color: 'var(--text-primary)', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>License Management</h2>
        <button className="btn btn-secondary" onClick={() => supabase.auth.signOut()}>Sign Out</button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <form onSubmit={createLicense} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Customer Name (optional)" 
            className="glass-input" 
            value={newCustomer} 
            onChange={e => setNewCustomer(e.target.value)} 
          />
          <button type="submit" className="btn btn-primary">Generate New License</button>
        </form>
      </div>

      <div className="glass-panel">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '1rem' }}>Key</th>
              <th style={{ padding: '1rem' }}>Customer</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Device Bound</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {licenses.map(lic => (
              <tr key={lic.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '1.1rem' }}>{lic.license_key}</td>
                <td style={{ padding: '1rem' }}>{lic.customer_name || 'N/A'}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ color: lic.is_active ? '#4ade80' : '#f87171' }}>
                    {lic.is_active ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {lic.device_id ? (
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }} title={lic.device_id}>Yes (ID Bound)</span>
                  ) : <span style={{ opacity: 0.5 }}>Unbound</span>}
                </td>
                <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleStatus(lic.id, lic.is_active)}>
                    {lic.is_active ? 'Revoke' : 'Restore'}
                  </button>
                  {lic.device_id && (
                    <button className="btn btn-sm btn-secondary" onClick={() => unbindDevice(lic.id)}>
                      Unbind Device
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {licenses.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No licenses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
