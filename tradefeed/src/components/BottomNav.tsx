import React from 'react';
import { LayoutGrid, CalendarDays, PieChart, Grid3X3, Newspaper, User } from 'lucide-react';
import { ViewType } from '../types';

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange }) => {
  const navItems: { id: ViewType; icon: any; label: string }[] = [
    { id: 'feed', icon: LayoutGrid, label: 'Feed' },
    { id: 'calendar', icon: CalendarDays, label: 'Cal' },
    { id: 'dashboard', icon: PieChart, label: 'Stats' },
    { id: 'gallery', icon: Grid3X3, label: 'Gallery' },
    { id: 'blog', icon: Newspaper, label: 'Blog' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-zinc-200 px-4 pb-6 pt-3 z-50">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive ? 'text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-indigo-50' : ''}`}>
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
              </div>
              <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => onViewChange('feed')}
          className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-all"
        >
          <div className="p-1 rounded-lg">
            <User className="w-6 h-6 stroke-[1.5px]" />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Profile</span>
        </button>
      </div>
    </nav>
  );
};
