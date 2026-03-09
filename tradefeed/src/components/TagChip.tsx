import React from 'react';

interface TagChipProps {
  label: string;
  type: 'emotion' | 'strategy' | 'mistake';
}

export const TagChip: React.FC<TagChipProps> = ({ label, type }) => {
  const getColors = () => {
    switch (type) {
      case 'emotion':
        return 'bg-indigo-50 text-indigo-600 border-indigo-300';
      case 'strategy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'mistake':
        return 'bg-rose-50 text-rose-600 border-rose-300';
      default:
        return 'bg-zinc-50 text-zinc-600 border-zinc-300';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getColors()}`}>
      {label}
    </span>
  );
};
