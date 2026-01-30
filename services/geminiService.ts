
import { MarketEvent } from "../types";

// Matrix for combinatorial "generative" events to keep them funny and fresh without API latency
const SUBJECTS = [
  "A rogue MEV bot", "Satoshi's ghost", "An Elon-controlled hamster", 
  "A drunk retail trader", "A Base Whale", "The SEC Intern", 
  "A 12-year-old dev", "A sentient Smart Contract", "A group of NFT Degens",
  "The ghost of a Liquidated Long", "A rogue AI on Base", "Vitalik's cat"
];

const ACTIONS = [
  "accidentally fat-fingered", "successfully bridged", "tweeted a blurry photo of", 
  "launched a vampire attack on", "lost a bet involving", "found a hidden vault of", 
  "accidentally burned", "minted 1 million copies of", "liquidated a 100x position of",
  "shorted the living daylights out of", "pumped a bag of"
];

const TARGETS = [
  "10,000 PEPE", "the entire ETH gas supply", "a rare rock NFT", 
  "his own seed phrase", "the USDC peg", "a 1-of-1 meme coin", 
  "the protocol's liquidity", "Base network's sequencer", "a mountain of DOGE",
  "the CEO's lunch money", "a 50x leveraged long"
];

const CONSEQUENCES = [
  { text: "Pure chaos ensued.", effect: "NEUTRAL", impact: 1.0 },
  { text: "The charts turned bright green.", effect: "BULLISH", impact: 1.6 },
  { text: "Absolute panic in the Discord.", effect: "BEARISH", impact: 1.4 },
  { text: "Institutions are FOMOing in.", effect: "BULLISH", impact: 1.8 },
  { text: "Retail is getting rekt.", effect: "BEARISH", impact: 1.5 },
  { text: "Gas fees are now higher than the GDP of a small nation.", effect: "NEUTRAL", impact: 1.1 },
  { text: "Lambos were ordered immediately.", effect: "BULLISH", impact: 1.4 },
  { text: "Everyone is staring at the 1m chart in silence.", effect: "NEUTRAL", impact: 1.0 },
  { text: "A massive green candle appeared from nowhere.", effect: "BULLISH", impact: 2.0 },
  { text: "Stop-losses are being hit like dominoes.", effect: "BEARISH", impact: 1.7 }
];

export const fetchMarketEvent = async (): Promise<MarketEvent> => {
  // We simulate a tiny delay to make it feel like "calculation" is happening, but very fast.
  await new Promise(resolve => setTimeout(resolve, 300));

  const sub = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
  const act = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const tar = TARGETS[Math.floor(Math.random() * TARGETS.length)];
  const con = CONSEQUENCES[Math.floor(Math.random() * CONSEQUENCES.length)];

  const eventName = `${sub} ${act.split(' ')[0]}s!`;
  const description = `${sub} ${act} ${tar}. ${con.text}`;

  return {
    name: eventName.toUpperCase(),
    description,
    effect: con.effect as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    impactMultiplier: con.impact
  };
};
