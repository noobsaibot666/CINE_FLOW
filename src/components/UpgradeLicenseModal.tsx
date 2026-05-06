import React, { useState } from 'react';
import { X, ShoppingBag, KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { openExternalUrl, PURCHASE_URL, SUPPORT_URL } from '../utils/externalLinks';

interface UpgradeLicenseModalProps {
  onClose: () => void;
  onActivated: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export function UpgradeLicenseModal({ onClose, onActivated }: UpgradeLicenseModalProps) {
  const [email, setEmail] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');

  const canActivate = email.trim().length > 0 && licenseKey.trim().length > 0 && !loading;

  const handleActivate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canActivate) return;

    setLoading(true);
    setMessage(null);
    setMessageTone('error');
    try {
      const res = await invoke<{ active?: boolean }>('activate_license', {
        email: email.trim().toLowerCase(),
        key: licenseKey.trim().toUpperCase(),
      });
      if (res?.active) {
        setMessageTone('success');
        setMessage('License activated. Unlocking CineFlow Suite...');
        setTimeout(onActivated, 700);
      } else {
        setMessage('Activation did not unlock the app. Please check your email and key.');
      }
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, 'Activation failed. Please check your email and key.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)' }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: '#0a0a0c',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18,
        boxShadow: '0 30px 90px rgba(0,0,0,0.65)',
        padding: 28,
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#a592ff', marginBottom: 8 }}>
              Upgrade CineFlow Suite
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 850, letterSpacing: 0 }}>Unlock the full version</h2>
          </div>
          <button onClick={onClose} aria-label="Close upgrade modal" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 8, width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => openExternalUrl(PURCHASE_URL)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              background: 'rgba(165,146,255,0.12)',
              border: '1px solid rgba(165,146,255,0.35)',
              color: '#fff',
              borderRadius: 12,
              padding: '16px 18px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShoppingBag size={18} color="#a592ff" />
              <span>
                <strong style={{ display: 'block', fontSize: 14 }}>Buy a license</strong>
                <span style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 }}>Open the CineFlow store in your browser.</span>
              </span>
            </span>
          </button>

          <form onSubmit={handleActivate} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 18, background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <KeyRound size={17} color="#a592ff" />
              <strong style={{ fontSize: 14 }}>Already have a key?</strong>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email used for purchase"
                style={inputStyle}
              />
              <input
                type="text"
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                placeholder="CF-XXXX-XXXX-XXXX"
                spellCheck={false}
                style={{ ...inputStyle, letterSpacing: '0.04em' }}
              />
              {message && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: messageTone === 'success' ? '#10b981' : '#f87171',
                  background: messageTone === 'success' ? 'rgba(16,185,129,0.07)' : 'rgba(248,113,113,0.06)',
                  border: `1px solid ${messageTone === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.18)'}`,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 12,
                  fontWeight: 650,
                }}>
                  {messageTone === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{message}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={!canActivate}
                style={{
                  height: 42,
                  border: 'none',
                  borderRadius: 10,
                  background: canActivate ? '#a592ff' : 'rgba(255,255,255,0.08)',
                  color: canActivate ? '#08080a' : 'rgba(255,255,255,0.35)',
                  fontSize: 11,
                  fontWeight: 850,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: canActivate ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Activate Key
              </button>
            </div>
          </form>
        </div>

        <button
          type="button"
          onClick={() => openExternalUrl(SUPPORT_URL)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.48)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
        >
          Need help?
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 10,
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  padding: '13px 14px',
};
