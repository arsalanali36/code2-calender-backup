/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  LogOut, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  Brain, 
  Activity,
  CheckCircle2,
  Zap,
  ShieldAlert,
  Image as ImageIcon,
  Maximize2,
  LayoutGrid
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

interface ToggleProps {
  label: string;
  value: boolean | null;
  onChange: (val: boolean) => void;
  className?: string;
  key?: string | number;
}

const Toggle = ({ 
  label, 
  value, 
  onChange, 
  className 
}: ToggleProps) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</span>
    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 w-fit">
      <button
        onClick={() => onChange(true)}
        className={cn(
          "px-3 py-1 rounded-md text-[10px] font-black transition-all duration-200",
          value === true 
            ? "bg-emerald-500/50 text-emerald-100 border border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.9)]" 
            : "text-slate-600 hover:text-slate-400"
        )}
      >
        Y
      </button>
      <button
        onClick={() => onChange(false)}
        className={cn(
          "px-3 py-1 rounded-md text-[10px] font-black transition-all duration-200",
          value === false 
            ? "bg-rose-500/50 text-rose-100 border border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.9)]" 
            : "text-slate-600 hover:text-slate-400"
        )}
      >
        N
      </button>
    </div>
  </div>
);

const MetricCard = ({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  trend 
}: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
      <Icon size={32} />
    </div>
    <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className={cn(
        "text-xl font-mono tracking-tighter font-black",
        trend === 'up' ? "text-emerald-400" : trend === 'down' ? "text-rose-400" : "text-white"
      )}>
        {value}
      </span>
      {subValue && <span className="text-[10px] font-bold text-slate-600 uppercase">{subValue}</span>}
    </div>
  </div>
);

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
    <Icon size={16} className="text-sky-500" />
    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">{title}</h3>
  </div>
);

const EmotionGroup = ({ title, positive, negative }: { title: string; positive: string[]; negative: string[] }) => (
  <div className="flex flex-col gap-4 h-full">
    <div className="flex items-center justify-center border-b border-slate-800 pb-3">
      <span className="text-[14px] font-black uppercase tracking-[0.25em] text-slate-200">{title}</span>
    </div>
    <div className="grid grid-cols-2 gap-4 flex-1">
      {/* Positive Column */}
      <div className="flex flex-col gap-4 bg-emerald-500/[0.02] p-4 rounded-2xl border border-emerald-500/10">
        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest text-center border-b border-emerald-500/10 pb-2">+</span>
        <div className="flex flex-col gap-4">
          {positive.map(label => (
            <Toggle 
              key={label} 
              label={label} 
              value={label === 'Patience' ? true : null} 
              onChange={(_val) => {}} 
            />
          ))}
        </div>
      </div>
      {/* Negative Column */}
      <div className="flex flex-col gap-4 bg-rose-500/[0.02] p-4 rounded-2xl border border-rose-500/10">
        <span className="text-[11px] font-black text-rose-400 uppercase tracking-widest text-center border-b border-rose-500/10 pb-2">-ve</span>
        <div className="flex flex-col gap-4">
          {negative.map(label => <Toggle key={label} label={label} value={null} onChange={(_val) => {}} />)}
        </div>
      </div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTrade, setActiveTrade] = useState('T2');
  const [date, setDate] = useState('2026-03-06');
  
  const trades = [
    { id: 'T1', status: 'loss' },
    { id: 'T2', status: 'win' },
    { id: 'T3', status: 'win' },
    { id: 'T4', status: 'loss' },
    { id: 'T5', status: 'loss' },
    { id: 'T6', status: 'neutral' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-400 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-black text-white tracking-tighter flex items-center gap-2">
              <Activity size={20} className="text-sky-500" />
              TRADE<span className="text-sky-500">LOG</span>
            </h1>
            
            <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <button className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white"><ChevronLeft size={16} /></button>
              <span className="text-xs font-mono font-bold text-slate-300 tracking-widest">{date}</span>
              <button className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-white"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Reset</button>
            <button className="px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all">Force Exit</button>
          </div>
        </header>

        {/* Trade Tabs with Status Hints */}
        <nav className="flex gap-2 p-1.5 bg-slate-900/50 border border-slate-800 rounded-2xl w-fit">
          {trades.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTrade(t.id)}
              className={cn(
                "relative px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 border-b-2",
                activeTrade === t.id 
                  ? "bg-slate-950 text-white border-sky-500 shadow-lg" 
                  : "text-slate-500 hover:text-slate-300 border-transparent",
                t.status === 'win' && activeTrade !== t.id && "border-b-emerald-500/40",
                t.status === 'loss' && activeTrade !== t.id && "border-b-rose-500/40"
              )}
            >
              {t.id}
            </button>
          ))}
        </nav>

        {/* Dashboard Stats - 4x2 Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="PT" value="-18.15" icon={Zap} trend="down" />
          <MetricCard label="P/L" value="-1251.64" icon={TrendingDown} trend="down" />
          <MetricCard label="Score" value="--" icon={CheckCircle2} />
          <MetricCard label="Dur" value="0" subValue="min" icon={Clock} />
          <MetricCard label="Tar" value="--" icon={Target} />
          <MetricCard label="Runn" value="--" icon={Activity} />
          <MetricCard label="SL" value="--" icon={ShieldAlert} />
          <MetricCard label="DD" value="--" icon={TrendingDown} />
        </section>

        {/* Setup & Image Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SETUP Section */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col gap-5">
            <SectionHeader title="SETUP" icon={LayoutGrid} />
            
            <div className="flex flex-col gap-4">
              {/* Strategy */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Strategy</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-sky-500/20" />
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">Reversal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-sky-500 focus:ring-sky-500/20" />
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">Cont</span>
                  </label>
                </div>
              </div>

              {/* Entry Type */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Entry Type</span>
                <select className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-slate-300 focus:outline-none focus:border-sky-500/50">
                  <option>Select</option>
                  <option>Aggressive</option>
                  <option>Conservative</option>
                </select>
              </div>

              <div className="h-px bg-slate-800/50 my-1" />

              {/* Zone Toggle */}
              <Toggle label="Zone" value={true} onChange={(_v) => {}} />

              {/* Zone Size */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Zone Size</span>
                <input type="text" placeholder="Enter size..." className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-slate-300 focus:outline-none focus:border-sky-500/50" />
              </div>

              {/* Zone Candle */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Zone Candle</span>
                <select className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-slate-300 focus:outline-none focus:border-sky-500/50">
                  <option>Select</option>
                  <option>Strong</option>
                  <option>Weak</option>
                </select>
              </div>

              {/* Break Candle > 20pt */}
              <Toggle label="Break Candle > 20pt" value={null} onChange={(_v) => {}} />

              {/* Placement */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Placement</span>
                <select className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-slate-300 focus:outline-none focus:border-sky-500/50">
                  <option>At Level</option>
                  <option>Above Level</option>
                  <option>Below Level</option>
                </select>
              </div>

              {/* Near */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Near</span>
                <select className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-slate-300 focus:outline-none focus:border-sky-500/50">
                  <option>Select</option>
                  <option>EMA 20</option>
                  <option>VWAP</option>
                </select>
              </div>
            </div>
          </div>

          {/* Optimized Image Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/50 border border-slate-800 p-2 rounded-3xl h-full min-h-[420px] flex flex-col relative group overflow-hidden shadow-2xl">
              <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 bg-black/60 rounded-xl text-white hover:bg-black/80 backdrop-blur-sm"><Maximize2 size={16} /></button>
                <button className="p-2 bg-black/60 rounded-xl text-white hover:bg-black/80 backdrop-blur-sm"><ImageIcon size={16} /></button>
              </div>
              
              <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                <img 
                  src="https://picsum.photos/seed/trading-chart/1200/800" 
                  alt="Trading Chart" 
                  className="w-full h-full object-cover opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-xl backdrop-blur-xl border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">NIFTY 10 MAR 24600 PE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logging Sections - Entry, Management, Exit in 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* ENTRY Section */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <SectionHeader title="ENTRY" icon={Target} />
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Breakout Candle</span>
                <select className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[11px] text-slate-300 focus:outline-none focus:border-sky-500/50">
                  <option>Select</option>
                  <option>Strong</option>
                  <option>Weak</option>
                  <option>Average</option>
                </select>
              </div>
              <Toggle label="DEMA" value={null} onChange={(_v) => {}} />
              <Toggle label="Algo signal" value={null} onChange={(_v) => {}} />
              <Toggle label="SL under 10" value={null} onChange={(_v) => {}} />
              <Toggle label="Dist > 20" value={null} onChange={(_v) => {}} />
            </div>
          </div>

          {/* MANAGEMENT Section */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <SectionHeader title="MANAGEMENT" icon={Activity} />
            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-start">
                <Toggle label="Nafs Pe Kabu" value={null} onChange={(_v) => {}} />
                <Toggle label="SL moved" value={false} onChange={(_v) => {}} />
              </div>
              <Toggle label="Patience" value={true} onChange={(_v) => {}} />
              <Toggle label="Confirmation" value={null} onChange={(_v) => {}} />
            </div>
          </div>

          {/* EXIT Section */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <SectionHeader title="EXIT" icon={LogOut} />
            <div className="flex flex-col gap-6">
              <Toggle label="Target move" value={null} onChange={(_v) => {}} />
              <Toggle label="> 10 pt" value={null} onChange={(_v) => {}} />
              <Toggle label="Profit trail" value={null} onChange={(_v) => {}} />
              <Toggle label="SL" value={null} onChange={(_v) => {}} />
              <Toggle label="Target" value={null} onChange={(_v) => {}} />
              <Toggle label="Kill Switch" value={null} onChange={(_v) => {}} />
            </div>
          </div>
        </div>

          {/* PSYCHOLOGY Section - Below the other three */}
          <div className="w-full">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl shadow-xl">
              <SectionHeader title="PSYCO (EMOTIONS)" icon={Brain} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <EmotionGroup 
                  title="Entry" 
                  positive={['Nafs Pe Kabu', 'Patience', 'Confirmation']} 
                  negative={['Impulsive', 'Desperate', 'Distracted', 'Panic']} 
                />
                <EmotionGroup 
                  title="Exit" 
                  positive={['Patience', 'Confirmation', 'Swing Creation']} 
                  negative={['Panic', 'Desperate', 'Sahi nahi lag raha']} 
                />
              </div>
              <div className="mt-10 p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl">
                <p className="text-[11px] leading-relaxed text-slate-500 font-medium italic text-center">
                  "Stick to the plan, ignore the noise."
                </p>
              </div>
            </div>
          </div>

        {/* Footer Actions */}
        <footer className="flex justify-end gap-4 mt-4">
          <button className="px-8 py-3 bg-slate-900 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all border border-slate-800">
            Save Draft
          </button>
          <button className="px-8 py-3 bg-sky-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-sky-500 shadow-xl shadow-sky-500/20 transition-all">
            Log Trade
          </button>
        </footer>
      </div>
    </div>
  );
}
