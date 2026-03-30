import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import './ActivationScreen.css';

export default function LicenseWrapper({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLicensed, setIsLicensed] = useState(false);
  const [inputKey, setInputKey] = useState('');

  useEffect(() => {
    checkLicense();
  }, []);

  async function checkLicense() {
    try {
      setLoading(true);
      setError(null);
      const savedKey = localStorage.getItem('AD_LICENSE_KEY');
      
      if (!savedKey) {
        setLoading(false);
        return;
      }

      let machineId;
      if (window.electronAPI?.getMachineId) {
        machineId = await window.electronAPI.getMachineId();
      } else {
        // Fallback for Web App
        machineId = localStorage.getItem('AD_BROWSER_ID');
        if (!machineId) {
          machineId = crypto.randomUUID();
          localStorage.setItem('AD_BROWSER_ID', machineId);
        }
      }
      
      if (!machineId) throw new Error("Could not determine hardware ID.");

      // Check key in supabase
      const { data, error: dbError } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', savedKey)
        .single();

      if (dbError || !data) {
        throw new Error("Invalid license key.");
      }

      if (!data.is_active) {
        throw new Error("This license has been deactivated by the administrator.");
      }

      if (data.device_id && data.device_id !== machineId) {
        throw new Error("This license is already bound to another device.");
      }

      // If no device_id bound yet, bind it now!
      if (!data.device_id) {
        const { error: updateError } = await supabase
          .from('licenses')
          .update({ device_id: machineId, activated_at: new Date().toISOString() })
          .eq('license_key', savedKey)
          // RLS check ensures it wasn't bound in the meantime
          .is('device_id', null);

        if (updateError) {
          throw new Error("Failed to bind your device. Someone else may have activated this key.");
        }
      }

      setIsLicensed(true);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setIsLicensed(false);
      localStorage.removeItem('AD_LICENSE_KEY');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(e) {
    e.preventDefault();
    if (!inputKey.trim()) return;
    localStorage.setItem('AD_LICENSE_KEY', inputKey.trim());
    await checkLicense();
  }

  if (loading) {
    return (
      <div className="activation-container glass-container">
        <div className="activation-card">
          <h2>Verifying License...</h2>
        </div>
      </div>
    );
  }

  if (isLicensed) {
    return <>{children}</>;
  }

  return (
    <div className="activation-container glass-container">
      <div className="activation-card glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Software Activation</h2>
        <p>Please enter your license key to register this device.</p>
        
        {error && <div className="activation-error" style={{ color: '#ff4d4d', marginTop: '1rem' }}>{error}</div>}

        <form onSubmit={handleActivate} style={{ marginTop: '1.5rem' }}>
          <input 
            type="text" 
            className="glass-input" 
            placeholder="AD-XYZ-1234" 
            value={inputKey} 
            onChange={e => setInputKey(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1.2rem', textAlign: 'center', marginBottom: '1rem' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            Activate Device
          </button>
        </form>
      </div>
    </div>
  );
}
