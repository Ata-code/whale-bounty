import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from 'wagmi';
import { CryptoCard, GameState, MarketEvent } from './types';
import { CRYPTO_CARDS, INITIAL_HP, ICONS } from './constants';
import { fetchMarketEvent } from './services/geminiService';
import { synth } from './services/audioService';
import Card from './components/Card';
import MarketPulse from './components/MarketPulse';
import Lobby, { shortAddress } from './components/Lobby';
import Provider from './wagmi';

const AUTH_STORAGE_KEY = 'whale-bounty-verified-address';

const AppContent: React.FC = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [context, setContext] = useState<any>(null);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [verifiedAddress, setVerifiedAddress] = useState<`0x${string}` | null>(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? (stored as `0x${string}`) : null;
    } catch {
      return null;
    }
  });
  const [isMusicOn, setIsMusicOn] = useState(true);
  const musicRef = useRef(true);
  const [isLoadingEvent, setIsLoadingEvent] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [playedCardId, setPlayedCardId] = useState<string | null>(null);
  const [whalePlayedCardId, setWhalePlayedCardId] = useState<string | null>(null);

  const [lastWhaleMove, setLastWhaleMove] = useState<string>("");
  const [lastPlayerMove, setLastPlayerMove] = useState<string>("");
  const [showHistory, setShowHistory] = useState(true);

  const historyEndRef = useRef<HTMLDivElement>(null);

  const handleVerified = useCallback((address: `0x${string}`) => {
    setVerifiedAddress(address);
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, address);
    } catch {}
  }, []);

  const [gameState, setGameState] = useState<GameState>({
    playerHP: INITIAL_HP,
    opponentHP: INITIAL_HP,
    playerHand: [],
    opponentHand: [],
    currentTurn: 'PLAYER',
    marketEvent: null,
    history: ['Connecting to Base Node...'],
    isGameOver: false,
    winner: null,
  });

  // Global listener to kickstart audio on first user interaction for browser policies
  useEffect(() => {
    const startAudio = () => {
      if (isMusicOn) {
        synth.start();
      }
      window.removeEventListener('click', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };

    window.addEventListener('click', startAudio);
    window.addEventListener('touchstart', startAudio);
    
    return () => {
      window.removeEventListener('click', startAudio);
      window.removeEventListener('touchstart', startAudio);
    };
  }, [isMusicOn]);

  useEffect(() => {
    musicRef.current = isMusicOn;
  }, [isMusicOn]);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.history]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await sdk.actions.ready();
      try {
        const ctx = await sdk.context;
        if (mounted) setContext(ctx);
      } catch (e) {
        console.warn("SDK context failed", e);
      } finally {
        if (mounted) {
          setIsFrameReady(true);
          const hasSeenTutorial = localStorage.getItem('whale-bounty-tutorial-seen');
          if (!hasSeenTutorial) setTutorialStep(0);
        }
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // NOTE: Do not auto-verify from wagmi. The player must click "Enter Game" to be verified.

  const drawCards = (count: number): CryptoCard[] => {
    const shuffled = [...CRYPTO_CARDS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const triggerNewMarketEvent = async () => {
    setIsLoadingEvent(true);
    const event = await fetchMarketEvent();
    setGameState(prev => ({
      ...prev,
      marketEvent: event,
      history: [...prev.history, `[MARKET] ${event.name}: ${event.description}`]
    }));
    if (musicRef.current) {
      synth.playSfx(event.effect === 'BULLISH' ? 'BULL' : event.effect === 'BEARISH' ? 'BEAR' : 'DRAW');
    }
    setIsLoadingEvent(false);
  };

  const initGame = useCallback(() => {
    setGameState({
      playerHP: INITIAL_HP,
      opponentHP: INITIAL_HP,
      playerHand: drawCards(5),
      opponentHand: drawCards(5),
      currentTurn: 'PLAYER',
      marketEvent: null,
      history: ['Whale Protocol Online. LFG!'],
      isGameOver: false,
      winner: null,
    });
    setLastWhaleMove("");
    setLastPlayerMove("");
    setPlayedCardId(null);
    setWhalePlayedCardId(null);
    triggerNewMarketEvent();
  }, []);

  useEffect(() => {
    if (isFrameReady && verifiedAddress) initGame();
  }, [isFrameReady, verifiedAddress, initGame]);

  const toggleMusic = () => {
    const nextState = !isMusicOn;
    if (nextState) synth.start();
    else synth.stop();
    setIsMusicOn(nextState);
  };

  const shareScore = () => {
    const text = gameState.winner === 'PLAYER' 
      ? `I just liquidated a Crypto Whale on Base! 🐋📈 #WhaleBounty #BaseMiniApp`
      : `Market volatility got me rekt! 📉💀 #WhaleBounty #BaseMiniApp`;
    // Open Twitter share in a new tab/window
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(twitterUrl, '_blank');
  };

  const handlePlayCard = async (card: CryptoCard) => {
    if (gameState.currentTurn !== 'PLAYER' || gameState.isGameOver || tutorialStep !== null || playedCardId) return;
    
    setPlayedCardId(card.id);
    if (musicRef.current) synth.playSfx('PLAY');

    await new Promise(resolve => setTimeout(resolve, 600));

    let damage = card.power;
    if (gameState.marketEvent) {
      if (gameState.marketEvent.effect === 'BULLISH') damage = Math.floor(damage * gameState.marketEvent.impactMultiplier * 1.5);
      else if (gameState.marketEvent.effect === 'BEARISH') damage = Math.floor(damage * 0.5);
    }

    const avgStability = gameState.opponentHand.reduce((acc, c) => acc + c.stability, 0) / (gameState.opponentHand.length || 1);
    const finalDamage = Math.max(1, Math.floor(damage - (avgStability / 4)));

    const moveText = `PUMPED ${card.symbol} for ${finalDamage} damage!`;
    setLastPlayerMove(moveText);
    setLastWhaleMove("");

    const newOpponentHP = Math.max(0, gameState.opponentHP - finalDamage);
    const newHand = gameState.playerHand.filter(c => c.id !== card.id);
    const finalHand = newHand.length < 3 ? [...newHand, ...drawCards(1)] : newHand;

    setGameState(prev => ({
      ...prev,
      opponentHP: newOpponentHP,
      playerHand: finalHand,
      currentTurn: 'OPPONENT',
      history: [...prev.history, moveText],
      isGameOver: newOpponentHP <= 0,
      winner: newOpponentHP <= 0 ? 'PLAYER' : null
    }));

    setPlayedCardId(null);

    if (newOpponentHP > 0) {
      setTimeout(cpuTurn, 1500);
    } else if (musicRef.current) {
      synth.playSfx('WIN');
    }
  };

  const cpuTurn = async () => {
    const whaleHand = gameState.opponentHand;
    const card = whaleHand[Math.floor(Math.random() * whaleHand.length)];
    
    setWhalePlayedCardId(card.id);
    if (musicRef.current) synth.playSfx('PLAY');

    await new Promise(resolve => setTimeout(resolve, 600));

    setGameState(prev => {
      if (prev.isGameOver) return prev;
      
      let damage = card.power;
      if (prev.marketEvent?.effect === 'BEARISH') damage = Math.floor(damage * prev.marketEvent.impactMultiplier * 1.5);
      
      const avgStability = prev.playerHand.reduce((acc, c) => acc + c.stability, 0) / (prev.playerHand.length || 1);
      const finalDamage = Math.max(1, Math.floor(damage - (avgStability / 4)));
      const newPlayerHP = Math.max(0, prev.playerHP - finalDamage);
      const newHand = prev.opponentHand.filter(c => c.id !== card.id);
      const finalHand = newHand.length < 3 ? [...newHand, ...drawCards(1)] : newHand;

      const whaleMoveText = `Whale DUMPED ${card.symbol}! -${finalDamage} HP`;
      setLastWhaleMove(whaleMoveText);
      setLastPlayerMove("");

      if (newPlayerHP <= 0 && musicRef.current) synth.playSfx('BEAR');

      return {
        ...prev,
        playerHP: newPlayerHP,
        opponentHand: finalHand,
        currentTurn: 'PLAYER',
        history: [...prev.history, whaleMoveText],
        isGameOver: newPlayerHP <= 0,
        winner: newPlayerHP <= 0 ? 'OPPONENT' : null
      };
    });
    
    setWhalePlayedCardId(null);
    setGameState(prev => {
      if (!prev.isGameOver) triggerNewMarketEvent();
      return prev;
    });
  };

  const tutorialMessages = [
    { title: "Welcome, Trader!", body: "Welcome to Whale Bounty. Your mission: Liquidate the Whale's portfolio before they dump yours." },
    { title: "Your Portfolio", body: "These are your cards. Power determines your damage. Stability protects you from Whale attacks." },
    { title: "The Market Pulse", body: "Pay attention! Bullish events boost your power, while Bearish events make your pumps weak." },
    { title: "WAGMI!", body: "Tap a card to Play/Pump. Good luck out there, the market is volatile!" }
  ];

  const nextTutorial = () => {
    if (tutorialStep !== null && tutorialStep < tutorialMessages.length - 1) {
      setTutorialStep(tutorialStep + 1);
      if (musicRef.current) synth.playSfx('DRAW');
    } else {
      setTutorialStep(null);
      localStorage.setItem('whale-bounty-tutorial-seen', 'true');
    }
  };

  if (!isFrameReady) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-[#0052FF] p-8 text-center font-bold">
        <div className="relative mb-6">
          <div className="w-20 h-20 border-4 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <img src="./icon.png" className="w-10 h-10 rounded-lg shadow-[0_0_15px_rgba(0,82,255,0.4)]" alt="loading" />
          </div>
        </div>
        <div className="mono tracking-[0.3em] text-sm animate-pulse uppercase">Syncing Ledger...</div>
        <div className="text-[10px] text-slate-500 mt-4 mono italic">Waiting for Block Confirmation...</div>
      </div>
    );
  }

  if (!verifiedAddress) {
    return <Lobby onVerified={handleVerified} connectedAddress={connectedAddress ? (connectedAddress as `0x${string}`) : null} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-slate-100 overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] select-none flex flex-wrap gap-8 items-center justify-center">
        {Array.from({length: 20}).map((_, i) => (
          <div key={i} className="text-8xl font-black -rotate-12">BASE WHALE REKT</div>
        ))}
      </div>

      <header className="z-20 bg-slate-900/90 backdrop-blur-xl border-b border-white/5 p-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-[#020617] shadow-[0_0_20px_rgba(0,82,255,0.2)] border border-[#0052FF]/30 p-0.5">
            <img 
              src="./icon.png" 
              className="w-full h-full object-cover rounded-lg" 
              alt="logo" 
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-blue-500 font-black text-xs italic">W</span>';
              }}
            />
          </div>
          <div>
            <h1 className="text-sm font-black leading-none uppercase tracking-tighter text-blue-50">Whale Bounty</h1>
            <p className="text-[10px] text-blue-500/80 mono font-bold">Base Mainnet v1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-black border transition-all ${showHistory ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
          >
            {showHistory ? 'HIDE TXS' : 'VIEW TXS'}
          </button>
          <button onClick={toggleMusic} className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs transition-colors border ${isMusicOn ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
            {isMusicOn ? '🔊' : '🔇'}
          </button>
          {(context?.user || verifiedAddress) && (
            <div className="hidden xs:flex items-center gap-2 bg-slate-800/40 pr-3 pl-1 py-1 rounded-lg border border-white/5">
              {context?.user ? (
                <>
                  <img src={context.user.pfpUrl} className="w-7 h-7 rounded-lg border border-white/10" alt="pfp" />
                  <span className="text-[10px] mono font-bold text-slate-300">@{context.user.username}</span>
                </>
              ) : (
                <span className="text-[10px] mono font-bold text-emerald-400/90" title={verifiedAddress!}>
                  {shortAddress(verifiedAddress!)}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className={`flex-1 flex flex-col justify-between p-2 sm:p-3 gap-1 sm:gap-2 overflow-hidden relative transition-all duration-500`}>
          {/* Opponent Zone */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-3 w-full max-w-xs px-2">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5 shadow-inner">
                <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-700" style={{ width: `${gameState.opponentHP}%` }}></div>
              </div>
              <span className="mono text-xs font-black text-rose-500">{gameState.opponentHP}%</span>
            </div>
            <div className="w-full max-w-full px-2 overflow-x-auto custom-scrollbar-hidden flex gap-2 justify-start sm:justify-center py-2 h-40 sm:h-52">
              {gameState.opponentHand.map((card, idx) => (
                <div key={`${card.id}-${idx}`} className="shrink-0 scale-90 sm:scale-100 origin-top">
                  <Card 
                    card={card} 
                    disabled 
                    isOpponent
                    isPlayed={whalePlayedCardId === card.id}
                  />
                </div>
              ))}
            </div>
            <div className="h-4 flex items-center justify-center mt-0.5">
              {lastWhaleMove && (
                <div className="text-[9px] sm:text-xs mono font-black text-rose-400 bg-rose-400/10 px-3 py-1 rounded border border-rose-400/30 animate-pulse uppercase tracking-widest">
                  {lastWhaleMove}
                </div>
              )}
            </div>
          </div>

          {/* Action Center */}
          <div className="flex flex-col items-center gap-1 sm:gap-2 z-10 shrink-0 px-2">
            <div className={`
                px-4 py-1.5 rounded-lg mono text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] border shadow-2xl transition-all duration-500
                ${gameState.currentTurn === 'PLAYER' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 animate-bounce' : 'bg-rose-500/20 text-rose-400 border-rose-500/50 opacity-50'}
            `}>
              {gameState.currentTurn === 'PLAYER' ? '>> CONFIRM TRADE <<' : 'Whale Manipulating...'}
            </div>
            
            <div className="w-full max-w-sm scale-85 xs:scale-95 sm:scale-100">
              <MarketPulse event={gameState.marketEvent} loading={isLoadingEvent} />
            </div>
          </div>

          {/* Player Zone */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="h-4 flex items-center justify-center mb-0.5">
              {lastPlayerMove && (
                <div className="text-[9px] sm:text-xs mono font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded border border-emerald-400/30 animate-pulse uppercase tracking-widest">
                  {lastPlayerMove}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full max-w-xs mb-1 px-2">
              <span className="mono text-xs font-black text-emerald-500">{gameState.playerHP}%</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5 shadow-inner">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700" style={{ width: `${gameState.playerHP}%` }}></div>
              </div>
            </div>

            <div className="w-full max-w-full px-2 overflow-x-auto custom-scrollbar-hidden flex gap-2 justify-start sm:justify-center py-2 h-40 sm:h-52">
              {gameState.playerHand.map((card, idx) => (
                <div key={`${card.id}-${idx}`} className="shrink-0 scale-90 sm:scale-100 origin-bottom">
                  <Card 
                    card={card} 
                    onClick={handlePlayCard}
                    disabled={gameState.currentTurn !== 'PLAYER' || gameState.isGameOver || tutorialStep !== null || !!playedCardId || !!whalePlayedCardId}
                    isPlayed={playedCardId === card.id}
                  />
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Persistent Transaction Ledger - Right Side */}
        <aside 
          className={`
            ${showHistory ? 'w-44 xs:w-56 sm:w-80' : 'w-0'} 
            transition-all duration-500 bg-slate-900/60 backdrop-blur-2xl border-l border-white/5 flex flex-col overflow-hidden relative z-30
          `}
        >
          <div className="p-3 border-b border-white/5 bg-slate-900/90 flex justify-between items-center shrink-0">
            <h3 className="mono font-black text-blue-400 text-[10px] uppercase tracking-widest">On-Chain Ledger</h3>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-black/20">
            {gameState.history.map((log, i) => (
              <div 
                key={i} 
                className={`
                  p-2.5 rounded-lg text-[8px] sm:text-[9px] mono border animate-in slide-in-from-right duration-300 shadow-sm
                  ${log.includes('MARKET') ? 'bg-blue-900/30 border-blue-800/50 text-blue-300' : 
                    log.includes('Whale') ? 'bg-rose-900/20 border-rose-800/30 text-rose-400' : 
                    'bg-emerald-900/20 border-emerald-800/30 text-emerald-400'}
                `}
              >
                <div className="opacity-40 mb-1 flex justify-between font-bold">
                  <span>HASH: 0x{Math.random().toString(16).substring(2, 8)}...</span>
                  <span>{new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <div className="font-bold leading-tight">
                  {log}
                </div>
              </div>
            ))}
            <div ref={historyEndRef} />
          </div>
          <div className="p-2 border-t border-white/5 bg-slate-900/80 shrink-0">
             <div className="flex justify-between mono text-[8px] text-slate-500 font-bold">
               <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> SYNCED</span>
               <span>v1.0.4-MAINNET</span>
             </div>
          </div>
        </aside>
      </div>

      {tutorialStep !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/70 backdrop-blur-[4px]">
          <div className="bg-slate-900 border border-blue-500/50 p-6 rounded-3xl max-w-sm w-full shadow-[0_0_60px_rgba(0,82,255,0.25)] animate-in zoom-in duration-300">
            <div className="flex justify-center mb-6">
               <div className="w-16 h-16 bg-[#020617] rounded-2xl border border-blue-500/40 p-1 shadow-[0_0_15px_rgba(0,82,255,0.3)]">
                  <img src="./icon.png" className="w-full h-full rounded-xl object-cover" alt="tutorial" />
               </div>
            </div>
            <h3 className="text-blue-400 mono font-black text-xl mb-2 uppercase tracking-tighter text-center">
              {tutorialMessages[tutorialStep].title}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-8 text-center px-2">
              {tutorialMessages[tutorialStep].body}
            </p>
            <button 
              onClick={nextTutorial}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_8px_20px_rgba(0,82,255,0.3)]"
            >
              {tutorialStep === tutorialMessages.length - 1 ? "Start Trading" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {gameState.isGameOver && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/5 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-[0_0_80px_rgba(0,0,0,0.8)]">
            <div className="mb-6 flex justify-center">
               <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shadow-2xl ${gameState.winner === 'PLAYER' ? 'bg-emerald-500/20 shadow-emerald-500/20' : 'bg-rose-500/20 shadow-rose-500/20'}`}>
                {gameState.winner === 'PLAYER' ? '🚀' : '💀'}
               </div>
            </div>
            <h2 className={`text-4xl font-black mb-2 tracking-tighter ${gameState.winner === 'PLAYER' ? 'text-emerald-500' : 'text-rose-500'}`}>
              {gameState.winner === 'PLAYER' ? 'WAGMI' : 'REKT'}
            </h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">
              {gameState.winner === 'PLAYER' 
                ? 'Liquidity secured. You successfully outplayed the Base Whale and exited at the top.' 
                : 'Margin call triggered. The whale dumped on your position and you were liquidated.'}
            </p>
            <div className="space-y-4">
              <button onClick={initGame} className="w-full py-5 bg-[#0052FF] hover:bg-blue-500 rounded-2xl font-black transition-all uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(0,82,255,0.4)] text-sm">
                Restart Protocol
              </button>
              <button onClick={shareScore} className="w-full py-4 bg-slate-800/80 hover:bg-slate-700 rounded-2xl font-bold transition-all uppercase tracking-widest text-slate-300 border border-white/5 text-xs">
                Broadcast Result
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Provider>
      <AppContent />
    </Provider>
  );
};

export default App;
