import React, { useState } from 'react';
import { X, ChevronRight, Camera, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface ImageImportProps {
  onNext: (images: string[]) => void;
  onCancel: () => void;
}

export const ImageImport: React.FC<ImageImportProps> = ({ onNext, onCancel }) => {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  // Mock gallery images
  const galleryImages = Array.from({ length: 12 }).map((_, i) => `https://picsum.photos/seed/gallery${i}/400/400`);

  const toggleImage = (url: string) => {
    if (selectedImages.includes(url)) {
      setSelectedImages(selectedImages.filter(img => img !== url));
    } else {
      setSelectedImages([...selectedImages, url]);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-100">
        <button onClick={onCancel} className="text-zinc-900">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-base font-bold text-zinc-900">New Trade Post</h2>
        <button 
          onClick={() => selectedImages.length > 0 && onNext(selectedImages)}
          disabled={selectedImages.length === 0}
          className={`text-sm font-bold transition-colors ${selectedImages.length > 0 ? 'text-indigo-600' : 'text-zinc-300'}`}
        >
          Next
        </button>
      </div>

      {/* Preview Area */}
      <div className="aspect-square bg-zinc-50 relative overflow-hidden">
        {selectedImages.length > 0 ? (
          <img 
            src={selectedImages[selectedImages.length - 1]} 
            alt="Preview" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
            <ImageIcon className="w-12 h-12 stroke-[1px]" />
            <p className="text-xs font-medium">Select a chart screenshot</p>
          </div>
        )}
        
        {selectedImages.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] text-white font-bold">
            {selectedImages.length} images selected
          </div>
        )}
      </div>

      {/* Gallery Picker */}
      <div className="flex-1 overflow-y-auto p-0.5">
        <div className="flex items-center justify-between px-3.5 py-3">
          <span className="text-sm font-bold text-zinc-900">Recent Screenshots</span>
          <div className="flex gap-4">
            <button className="p-2 bg-zinc-100 rounded-full text-zinc-600">
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-0.5">
          {galleryImages.map((url, i) => {
            const isSelected = selectedImages.includes(url);
            const selectedIndex = selectedImages.indexOf(url) + 1;
            
            return (
              <button 
                key={i} 
                onClick={() => toggleImage(url)}
                className="aspect-square relative group overflow-hidden"
              >
                <img 
                  src={url} 
                  alt={`Gallery ${i}`} 
                  className={`w-full h-full object-cover transition-transform group-hover:scale-110 ${isSelected ? 'opacity-50' : ''}`}
                  referrerPolicy="no-referrer"
                />
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
                    {selectedIndex}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
