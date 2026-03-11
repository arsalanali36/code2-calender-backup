import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Plus, Tag } from 'lucide-react';
import { motion } from 'motion/react';

interface TaggerProps {
  images: string[];
  onNext: (tags: { emotion: string[], strategy: string[], mistake: string[] }) => void;
  onBack: () => void;
}

export const Tagger: React.FC<TaggerProps> = ({ images, onNext, onBack }) => {
  const [selectedEmotion, setSelectedEmotion] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string[]>([]);
  const [selectedMistake, setSelectedMistake] = useState<string[]>([]);

  const emotions = ['Panic', 'Revenge', 'Discipline', 'Calm', 'Boredom', 'Confidence', 'Fear', 'Greed'];
  const strategies = ['Breakout', 'Pullback', 'VCP Pattern', 'Scalp', 'Trend Following', 'Mean Reversion'];
  const mistakes = ['Overtrading', 'Early Exit', 'Late Entry', 'Low Conviction', 'No Stop Loss'];

  const toggleTag = (tag: string, category: 'emotion' | 'strategy' | 'mistake') => {
    const setMap = {
      emotion: { state: selectedEmotion, setter: setSelectedEmotion },
      strategy: { state: selectedStrategy, setter: setSelectedStrategy },
      mistake: { state: selectedMistake, setter: setSelectedMistake },
    };
    
    const { state, setter } = setMap[category];
    if (state.includes(tag)) {
      setter(state.filter(t => t !== tag));
    } else {
      setter([...state, tag]);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100">
        <button onClick={onBack} className="text-zinc-900">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-bold text-zinc-900">Tag Your Trade</h2>
        <button 
          onClick={() => onNext({ emotion: selectedEmotion, strategy: selectedStrategy, mistake: selectedMistake })}
          className="text-sm font-bold text-indigo-600"
        >
          Next
        </button>
      </div>

      {/* Image Preview List */}
      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar border-b border-zinc-100">
        {images.map((url, i) => (
          <div key={i} className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-zinc-200">
            <img src={url} alt={`Selected ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        ))}
      </div>

      {/* Tagging Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* Emotion Tags */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Emotion Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {emotions.map(tag => (
              <button 
                key={tag}
                onClick={() => toggleTag(tag, 'emotion')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  selectedEmotion.includes(tag) 
                  ? 'bg-indigo-600 text-white border-indigo-600' 
                  : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-indigo-200'
                }`}
              >
                {tag}
              </button>
            ))}
            <button className="p-1.5 bg-zinc-100 rounded-full text-zinc-400">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Strategy Tags */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Strategy Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {strategies.map(tag => (
              <button 
                key={tag}
                onClick={() => toggleTag(tag, 'strategy')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  selectedStrategy.includes(tag) 
                  ? 'bg-emerald-600 text-white border-emerald-600' 
                  : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-emerald-200'
                }`}
              >
                {tag}
              </button>
            ))}
            <button className="p-1.5 bg-zinc-100 rounded-full text-zinc-400">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Mistake Tags */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">Mistake Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {mistakes.map(tag => (
              <button 
                key={tag}
                onClick={() => toggleTag(tag, 'mistake')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  selectedMistake.includes(tag) 
                  ? 'bg-rose-600 text-white border-rose-600' 
                  : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-rose-200'
                }`}
              >
                {tag}
              </button>
            ))}
            <button className="p-1.5 bg-zinc-100 rounded-full text-zinc-400">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
