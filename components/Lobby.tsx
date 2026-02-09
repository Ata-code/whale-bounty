import React, { useState, useEffect } from 'react';
import { generateNonce, signInWithBase, type AuthError } from '../services/baseAuth';

/** Shorten address for display */
function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface LobbyProps {
  onVerified: (address: `0x${string}`) => void;
}

/**
 * Lobby screen: Sign in with Base to verify account, then enter game.
 * Uses Base Account auth flow per https://docs.base.org/base-account/guides/authenticate-users
 */
const Lobby: React.FC<LobbyProps> = ({ onVerified }) => {
  const [nonce, setNonce] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefetch nonce on mount to avoid popup blockers when user clicks Sign in
  useEffect(() => {
    setNonce(generateNonce());
  }, []);

  const handleSignIn = async () => {
    if (!nonce) {
      setNonce(generateNonce());
    }
    const n = nonce || generateNonce();
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithBase(n);
      onVerified(result.address);
    } catch (err: unknown) {
      const authErr = err as AuthError;
      const message =
        authErr?.code === 'METHOD_NOT_SUPPORTED'
          ? 'Wallet does not support Sign in with Base. Try Coinbase Wallet or open in Base in-app browser.'
          : authErr?.message || (err instanceof Error ? err.message : 'Sign in failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-slate-100 overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] select-none flex flex-wrap gap-8 items-center justify-center">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="text-8xl font-black -rotate-12">
            BASE WHALE REKT
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center bg-[#020617] border border-[#0052FF]/30 shadow-[0_0_20px_rgba(0,82,255,0.2)] mb-6">
            <img
              src="./icon.png"
              className="w-full h-full object-cover"
              alt="Whale Bounty"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const el = (e.target as HTMLImageElement).parentElement;
                if (el) el.innerHTML = '<span class="text-blue-500 font-black text-2xl italic">W</span>';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-blue-50 mb-2">
            Whale Bounty
          </h1>
          <p className="text-[10px] text-blue-500/80 mono font-bold uppercase tracking-widest mb-1">
            Base Mainnet
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-xs">
            Prove ownership of your Base account to enter the arena. Liquidate the Whale before they dump on you.
          </p>

          {error && (
            <div className="w-full mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-left">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="
              flex items-center justify-center gap-2 px-6 py-4 rounded-xl
              bg-white text-black border-0 cursor-pointer
              font-semibold text-sm min-w-[200px] h-12
              disabled:opacity-60 disabled:cursor-not-allowed
              hover:bg-slate-100 active:scale-[0.98] transition-all
              shadow-[0_4px_20px_rgba(255,255,255,0.15)]
            "
            style={{
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <div
              className="w-4 h-4 rounded-sm flex-shrink-0"
              style={{ backgroundColor: '#0052FF' }}
            />
            <span>{loading ? 'Connecting…' : 'Sign in with Base'}</span>
          </button>

          <p className="text-slate-500 text-[10px] mt-6 max-w-xs">
            Uses Sign in with Ethereum (SIWE). No password; your wallet signs a one-time message.
          </p>
        </div>
      </div>

      <footer className="p-4 text-center text-slate-600 text-[10px] mono relative z-10">
        Whale Bounty · Base Account auth
      </footer>
    </div>
  );
};

export default Lobby;

export { shortAddress };
