import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Upload, ImagePlus, Copy, Share2, Flag, Trash2 } from 'lucide-react';

interface MoreMenuProps {
  show: boolean;
  uploadStatus: 'idle' | 'uploading' | 'done' | 'error';
  addStatus: 'idle' | 'uploading' | 'done' | 'error';
  className?: string;
  onClose: () => void;
  onDownload: () => void;
  onUpload: () => void;
  onAddAfter: () => void;
  onCopy: () => void;
}

export const MoreMenu: React.FC<MoreMenuProps> = ({
  show, uploadStatus, addStatus, className = '', onClose, onDownload, onUpload, onAddAfter, onCopy,
}) => {
  const uploadLabel = uploadStatus === 'uploading' ? 'Uploading…' : uploadStatus === 'done' ? 'Replaced ✓' : uploadStatus === 'error' ? 'Replace failed' : 'Upload & Replace';
  const addLabel    = addStatus    === 'uploading' ? 'Uploading…' : addStatus    === 'done' ? 'Added ✓'    : addStatus    === 'error' ? 'Add failed'    : 'Add Image After';

  const items = [
    { icon: <Download  className="w-4 h-4 text-sky-400"     />, label: 'Download Image', action: 'download' },
    { icon: <Upload    className="w-4 h-4 text-emerald-400" />, label: uploadLabel,       action: 'upload'   },
    { icon: <ImagePlus className="w-4 h-4 text-violet-400"  />, label: addLabel,          action: 'add'      },
    { icon: <Copy      className="w-4 h-4 text-sky-300"     />, label: 'Copy Image',      action: 'copy'     },
    { icon: <Share2    className="w-4 h-4"                  />, label: 'Share link',      action: ''         },
    { icon: <Flag      className="w-4 h-4"                  />, label: 'Mark for review', action: ''         },
    { icon: <Trash2    className="w-4 h-4 text-rose-400"    />, label: 'Delete Image',    action: '', danger: true },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`absolute bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl w-44 z-30 max-h-[60vh] overflow-y-auto ${className}`}
          onClick={e => e.stopPropagation()}
        >
          {items.map(item => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors text-left ${item.danger ? 'text-rose-400' : 'text-white'}`}
              onClick={() => {
                if (item.action === 'download') onDownload();
                else if (item.action === 'upload') onUpload();
                else if (item.action === 'add') onAddAfter();
                else if (item.action === 'copy') onCopy();
                onClose();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
