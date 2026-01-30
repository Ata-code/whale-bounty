
import React from 'react';
import { CryptoCard } from '../types';
import { ICONS } from '../constants';

interface CardProps {
  card: CryptoCard;
  onClick?: (card: CryptoCard) => void;
  disabled?: boolean;
  isHidden?: boolean;
  isPlayed?: boolean;
  isOpponent?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, disabled, isHidden, isPlayed, isOpponent }) => {
  if (isHidden) {
    return (
      <div className="w-24 h-36 sm:w-32 sm:h-48 bg-slate-950 rounded-xl border-4 border-[#0052FF]/30 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
        {/* Holographic ledger background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,82,255,0.15),transparent)]"></div>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none grid grid-cols-4 gap-1 p-1">
          {Array.from({length: 32}).map((_, i) => (
             <div key={i} className="h-1 bg-white rounded-full"></div>
          ))}
        </div>
        
        {/* Central whale icon */}
        <div className="z-10 text-center relative">
          <div className="text-[#0052FF] drop-shadow-[0_0_15px_rgba(0,82,255,0.6)] mb-2 group-hover:scale-110 transition-transform duration-500">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M2 16c.5 0 1 0 1.5-.5.5-.5.5-1.5 1-2.5 1-2 2-4.5 4-5.5 2-1 4-1 6 0 2 1 3 3.5 4 5.5.5 1 .5 2 1 2.5.5.5 1 .5 1.5.5" />
              <path d="M12 21v-2" />
              <path d="M8 14h8" />
            </svg>
          </div>
          <div className="text-[9px] sm:text-[10px] font-black text-[#0052FF]/80 mono tracking-[0.2em] uppercase">LEDGER-01</div>
        </div>

        {/* Decorative corner accents */}
        <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#0052FF]"></div>
        <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#0052FF]"></div>
      </div>
    );
  }

  const animationClass = isOpponent ? 'animate-card-play-down' : 'animate-card-play';

  return (
    <button
      onClick={() => !disabled && onClick?.(card)}
      disabled={disabled}
      className={`
        w-24 h-36 sm:w-32 sm:h-48 rounded-xl border-2 p-2 flex flex-col justify-between 
        card-transition shadow-xl relative group overflow-hidden
        ${card.color} border-white/20 
        ${!disabled && !isPlayed ? 'hover:scale-105 hover:-translate-y-2' : ''}
        ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}
        ${isPlayed ? `${animationClass} pointer-events-none` : ''}
      `}
    >
      <div className="absolute top-0 right-0 p-1 opacity-20">
         <ICONS.Zap />
      </div>

      <div className="z-10">
        <div className="flex justify-between items-start">
          <span className="mono font-bold text-sm sm:text-lg leading-none">{card.symbol}</span>
          <span className="text-[8px] sm:text-[10px] uppercase font-bold px-1 bg-black/30 rounded whitespace-nowrap overflow-hidden max-w-[50px]">{card.type.split('_')[0]}</span>
        </div>
        <h3 className="text-[10px] sm:text-xs font-bold truncate mt-0.5">{card.name}</h3>
      </div>

      <div className="flex-1 flex items-center justify-center py-1">
         <div className="text-2xl sm:text-3xl font-black drop-shadow-md">
            {card.power}
         </div>
      </div>

      <div className="z-10">
        <div className="flex justify-between text-[8px] sm:text-[10px] mb-0.5">
          <div className="flex items-center gap-0.5">
            <ICONS.TrendingUp /> {card.power}
          </div>
          <div className="flex items-center gap-0.5">
            <ICONS.Shield /> {card.stability}
          </div>
        </div>
        <p className="hidden sm:block text-[8px] leading-tight opacity-90 italic line-clamp-2">
          "{card.flavorText}"
        </p>
      </div>
    </button>
  );
};

export default Card;
