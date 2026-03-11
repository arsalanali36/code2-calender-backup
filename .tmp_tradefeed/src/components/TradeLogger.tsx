import React, { useState } from 'react';
import { ChevronLeft, Check, TrendingUp, TrendingDown, Clock, MapPin, User } from 'lucide-react';
import { motion } from 'motion/react';
import { Trade, TradeSession, TradeType } from '../types';

interface TradeLoggerProps {
  images: string[];
  tags: { emotion: string[], strategy: string[], mistake: string[] };
  onSave: (trade: Partial<Trade>) => void;
  onBack: () => void;
}

export const TradeLogger: React.FC<TradeLoggerProps> = ({ images, tags, onSave, onBack }) => {
  const [instrument, setInstrument] = useState('NIFTY 25000 CALL');
  const [pnl, setPnl] = useState('0');
  const [type, setType] = useState<TradeType>('Long');
  const [session, setSession] = useState<TradeSession>('Morning');
  const [note, setNote] = useState('');
  const [rMultiple, setRMultiple] = useState('1.0');
  const [riskReward, setRiskReward] = useState('1:2');
  const [positionSize, setPositionSize] = useState('50');

  const handleSave = () => {
    onSave({
      instrument,
      pnl: parseFloat(pnl),
      type,
      session,
      note,
      chartUrls: images,
      emotionTags: tags.emotion,
      strategyTags: tags.strategy,
      mistakeTags: tags.mistake,
      stats: {
        rMultiple: parseFloat(rMultiple),
        riskReward,
        positionSize: parseInt(positionSize),
      },
      date: new Date().toISOString().split('T')[0],
      currency: '₹',
    });
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100">
        <button onClick={onBack} className="text-zinc-900">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-bold text-zinc-900">New Trade</h2>
        <button 
          onClick={handleSave}
          className="text-sm font-bold text-indigo-600"
        >
          Share
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Top Info Row */}
        <div className="p-4 flex gap-4 border-b border-zinc-100">
          <div className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-200 flex-shrink-0">
            <img src={images[0]} alt="Trade" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <textarea 
            placeholder="Write a note or lesson learned..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 text-sm text-zinc-600 outline-none resize-none pt-1"
          />
        </div>

        {/* Trade Details Form */}
        <div className="divide-y divide-zinc-100">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-zinc-900">Instrument</span>
            </div>
            <input 
              type="text" 
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className="text-sm font-bold text-zinc-900 text-right outline-none bg-transparent"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${parseFloat(pnl) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {type === 'Long' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
              <span className="text-sm font-medium text-zinc-900">P&L (₹)</span>
            </div>
            <input 
              type="number" 
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              className={`text-sm font-bold text-right outline-none bg-transparent ${parseFloat(pnl) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-zinc-900">Session</span>
            </div>
            <select 
              value={session}
              onChange={(e) => setSession(e.target.value as TradeSession)}
              className="text-sm font-bold text-zinc-900 outline-none bg-transparent border-none appearance-none cursor-pointer"
            >
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
            </select>
          </div>

          {/* Stats Section */}
          <div className="p-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Advanced Stats</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold">R-Multiple</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={rMultiple}
                  onChange={(e) => setRMultiple(e.target.value)}
                  className="w-full text-sm font-bold text-zinc-900 outline-none bg-zinc-50 p-2 rounded-lg border border-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold">Risk/Reward</label>
                <input 
                  type="text" 
                  value={riskReward}
                  onChange={(e) => setRiskReward(e.target.value)}
                  className="w-full text-sm font-bold text-zinc-900 outline-none bg-zinc-50 p-2 rounded-lg border border-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold">Pos. Size</label>
                <input 
                  type="number" 
                  value={positionSize}
                  onChange={(e) => setPositionSize(e.target.value)}
                  className="w-full text-sm font-bold text-zinc-900 outline-none bg-zinc-50 p-2 rounded-lg border border-zinc-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social Options */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-zinc-900">Add Location</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-zinc-300 rotate-180" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-zinc-400" />
              <span className="text-sm text-zinc-900">Tag Strategy</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-zinc-300 rotate-180" />
          </div>
        </div>
      </div>
    </div>
  );
};
