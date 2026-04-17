import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Plus, Check, Loader2 } from 'lucide-react';

interface TagSheetProps {
  imageUrl: string;
  currentTags: string[];
  currentNote: string;
  onSave: (tags: string[], note: string) => void;
  onClose: () => void;
}

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';

const GROUP_COLORS: Record<string, { bg: string; border: string; text: string; active: string }> = {
  emotions:    { bg: 'bg-violet-500/20', border: 'border-violet-400/40', text: 'text-violet-300', active: 'bg-violet-500' },
  emotion:     { bg: 'bg-violet-500/20', border: 'border-violet-400/40', text: 'text-violet-300', active: 'bg-violet-500' },
  mistakes:    { bg: 'bg-rose-500/20',   border: 'border-rose-400/40',   text: 'text-rose-300',   active: 'bg-rose-500'   },
  mistake:     { bg: 'bg-rose-500/20',   border: 'border-rose-400/40',   text: 'text-rose-300',   active: 'bg-rose-500'   },
  'entry type':{ bg: 'bg-sky-500/20',    border: 'border-sky-400/40',    text: 'text-sky-300',    active: 'bg-sky-500'    },
  'exit type': { bg: 'bg-amber-500/20',  border: 'border-amber-400/40',  text: 'text-amber-300',  active: 'bg-amber-500'  },
};

function groupColor(group: string) {
  return GROUP_COLORS[group.toLowerCase()] ?? { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-300', active: 'bg-emerald-500' };
}

export const TagSheet: React.FC<TagSheetProps> = ({ imageUrl, currentTags, currentNote, onSave, onClose }) => {
  const [selected, setSelected] = useState<string[]>(currentTags);
  const [note, setNote] = useState(currentNote);
  const [search, setSearch] = useState('');
  const [tagGroups, setTagGroups] = useState<Record<string, string[]>>({});
  const [newTagText, setNewTagText] = useState('');
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/trades`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.tagGroups) setTagGroups(d.tagGroups); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (addingToGroup) setTimeout(() => addInputRef.current?.focus(), 80);
  }, [addingToGroup]);

  const toggle = (tag: string) =>
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const addNewTag = (group: string) => {
    const t = newTagText.trim();
    if (!t) { setAddingToGroup(null); return; }
    setTagGroups(prev => ({ ...prev, [group]: [...(prev[group] || []), t] }));
    setSelected(prev => [...prev, t]);
    setNewTagText('');
    setAddingToGroup(null);
    persistNewTag(group, t);
  };

  const persistNewTag = async (group: string, tag: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.tagGroups) data.tagGroups = {};
      if (!data.tagGroups[group]) data.tagGroups[group] = [];
      if (!data.tagGroups[group].includes(tag)) data.tagGroups[group].push(tag);
      await fetch(`${BASE_URL}/api/trades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
    } catch {}
  };

  const toRaw = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) { try { return new URL(url).pathname; } catch { return url; } }
    return url;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(false);
    try {
      const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const rawImg = toRaw(imageUrl);
      let found = false;
      for (const t of (data.trades || [])) {
        const imgs: string[] = t.images || [];
        if (imgs.some((u: string) => u === rawImg || toRaw(u) === rawImg)) {
          t.Tags = selected;
          t.Note = note;
          found = true; break;
        }
      }
      if (!found) {
        for (const dd of Object.values(data.dayData || {})) {
          const imgs: string[] = (dd as any).images || [];
          if (imgs.some((u: string) => u === rawImg || toRaw(u) === rawImg)) {
            (dd as any).Tags = selected;
            (dd as any).obs = note;
            found = true; break;
          }
        }
      }
      await fetch(`${BASE_URL}/api/trades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
      onSave(selected, note);
    } catch { setSaveErr(true); setSaving(false); }
  };

  const allGroups = Object.entries(tagGroups);
  const q = search.toLowerCase();
  const filteredGroups = q
    ? allGroups.map(([g, tags]) => [g, tags.filter(t => t.toLowerCase().includes(q))] as [string, string[]]).filter(([, tags]) => tags.length > 0)
    : allGroups;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex flex-col justify-end"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-zinc-900 rounded-t-2xl max-h-[88vh] flex flex-col border-t border-white/10 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b border-white/10">
            <h2 className="text-sm font-bold text-white">Assign Tags</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-2 border border-white/10">
              <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search tags…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
              {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-white/30" /></button>}
            </div>
          </div>

          {/* Selected pills summary */}
          {selected.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {selected.map(t => (
                <button key={t} onClick={() => toggle(t)} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2 py-0.5 rounded-full">
                  {t} <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          )}

          {/* Tag Groups */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {filteredGroups.length === 0 && (
              <p className="text-center text-white/30 text-xs py-6">No tags found</p>
            )}
            {filteredGroups.map(([group, tags]) => {
              const c = groupColor(group);
              return (
                <div key={group} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{group}</span>
                    <button onClick={() => { setAddingToGroup(group); setNewTagText(''); }} className="p-0.5 rounded-full hover:bg-white/10 transition-colors">
                      <Plus className="w-3.5 h-3.5 text-white/40" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => {
                      const isOn = selected.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggle(tag)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all flex items-center gap-1 ${isOn ? `${c.active} border-transparent text-white` : `${c.bg} ${c.border} ${c.text}`}`}
                        >
                          {isOn && <Check className="w-2.5 h-2.5" />}
                          {tag}
                        </button>
                      );
                    })}
                    {addingToGroup === group && (
                      <input
                        ref={addInputRef}
                        type="text"
                        value={newTagText}
                        onChange={e => setNewTagText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addNewTag(group); if (e.key === 'Escape') setAddingToGroup(null); }}
                        onBlur={() => { if (newTagText.trim()) addNewTag(group); else setAddingToGroup(null); }}
                        placeholder="New tag…"
                        className={`px-2.5 py-1 rounded-full text-[11px] bg-transparent border ${c.border} ${c.text} outline-none w-24`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Note / Pin field */}
          <div className="px-4 pb-2 flex-shrink-0 border-t border-white/10 pt-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1.5 block">📌 Pin Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for this trade…"
              rows={2}
              className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none resize-none"
            />
          </div>

          {/* Save button */}
          <div className="px-4 pb-6 pt-2 flex-shrink-0">
            {saveErr && <p className="text-center text-rose-400 text-xs mb-2">Save failed — try again</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white disabled:opacity-60"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : `Save${selected.length > 0 ? ` · ${selected.length} tag${selected.length > 1 ? 's' : ''}` : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
