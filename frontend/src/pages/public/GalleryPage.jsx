import React, { useState, useEffect } from 'react';
import { Image, Video, Sparkles, Filter, X, ZoomIn } from 'lucide-react';
import api from '../../services/api';
import TempleBorder from '../../components/common/TempleBorder';
import KolamDivider from '../../components/common/KolamDivider';
import { getMediaUrl } from '../../utils/media';

const defaultGalleryItems = [
  {
    id: 'gal-local-1',
    title: 'Nataraja Cosmic Dance & Divine Rhythm',
    category: 'performances',
    media_url: '/BG1.png',
  },
  {
    id: 'gal-local-2',
    title: 'Aramandi Posture & Sacred Salangai Bells',
    category: 'salangai-pooja',
    media_url: '/BG.2.png',
  },
  {
    id: 'gal-01',
    title: 'Navarasa Abhinaya in Varnam',
    category: 'performances',
    media_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'gal-02',
    title: 'Salangai Pooja Holy Bell Dedication',
    category: 'salangai-pooja',
    media_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'gal-03',
    title: 'Arangetram Solo Margam Debut',
    category: 'arangetram',
    media_url: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'gal-04',
    title: 'Morning Sadhana - Adavu Geometric Drills',
    category: 'classroom',
    media_url: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'gal-05',
    title: 'Thillana Finale at Chidambaram Natyanjali',
    category: 'performances',
    media_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'gal-06',
    title: 'Aharya Abhinaya - Temple Silk Costume Styling',
    category: 'classroom',
    media_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1000&q=80',
  },
];

export default function GalleryPage() {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('all');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGallery() {
      try {
        const res = await api.get(`/gallery?category=${category}`);
        if (res.data.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          // Prepend local highlights if on 'all' or matching category
          const apiData = res.data.data;
          setItems(apiData);
        } else {
          // Filter default gallery
          const filtered = category === 'all' 
            ? defaultGalleryItems 
            : defaultGalleryItems.filter(item => item.category === category);
          setItems(filtered);
        }
      } catch (err) {
        console.error('Failed to load gallery from API, using curated archive:', err);
        const filtered = category === 'all' 
          ? defaultGalleryItems 
          : defaultGalleryItems.filter(item => item.category === category);
        setItems(filtered);
      } finally {
        setLoading(false);
      }
    }
    loadGallery();
  }, [category]);

  const categories = [
    { id: 'all', name: 'All Media' },
    { id: 'performances', name: 'Stage Performances' },
    { id: 'arangetram', name: 'Arangetrams' },
    { id: 'salangai-pooja', name: 'Salangai Pooja' },
    { id: 'classroom', name: 'Classroom & Sadhana' },
  ];

  const displayedItems = items.length > 0 
    ? items 
    : (category === 'all' ? defaultGalleryItems : defaultGalleryItems.filter(i => i.category === category));

  return (
    <div className="gallery bg-[#0f0f0f] text-white min-h-screen py-[90px] px-4 sm:px-[8%]">
      <div className="max-w-7xl mx-auto">
        
        {/* Gallery Header */}
        <div className="gallery-header text-center mb-[50px]">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#111111] border border-[#333333] text-[#d4af37] text-xs font-cinzel uppercase tracking-[3px] mb-4">
            <img src="/logo.png" alt="Sri Ruthralaya" className="w-4 h-4 object-contain" />
            <span>Visual Splendor • Sacred Dance Archives</span>
          </div>
          <h2 className="font-cinzel text-3xl sm:text-[42px] font-bold text-white mb-[15px] leading-tight">
            Performance <span className="text-[#d4af37]">Gallery</span>
          </h2>
          <p className="text-[#aaa] text-base font-outfit max-w-xl mx-auto leading-relaxed">
            Moments of devotion, rhythm, and grace captured on temple stages, Arangetrams, and sacred auditoriums.
          </p>
        </div>

        <TempleBorder />

        {/* Filter Pills */}
        <div className="my-10 flex flex-wrap items-center justify-center gap-2.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-5 py-2 rounded-full text-xs font-cinzel tracking-wider font-semibold transition-all duration-300 ${
                category === c.id
                  ? 'bg-[#d4af37] text-[#111111] font-bold border border-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.35)] scale-105'
                  : 'bg-[#111111] text-[#bbbbbb] border border-[#333333] hover:border-[#d4af37] hover:text-[#d4af37]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Gallery Grid matching .gallery-grid and .gallery-item */}
        <div className="gallery-grid max-w-[1000px] mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
          {displayedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedMedia(item)}
              className="gallery-item h-[260px] overflow-hidden rounded-[10px] border border-[#333333] relative group cursor-pointer hover:border-[#d4af37] transition-all duration-300 shadow-xl bg-[#111111]"
            >
              <img
                src={getMediaUrl(item.media_url)}
                alt={item.title}
                className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/BG1.png';
                }}
              />

              {/* Category pill on top right */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-[#0f0f0f]/90 text-[#d4af37] border border-[#333333] text-[10px] font-cinzel uppercase tracking-wider shadow">
                {item.category ? item.category.replace('-', ' ') : 'Gallery'}
              </div>

              {/* Bottom gradient hover bar */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                <span className="font-cinzel text-xs text-[#d4af37] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Click to Expand</span>
                </span>
                <h3 className="font-cinzel font-bold text-sm text-white line-clamp-1">
                  {item.title}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* Lightbox / Modal Viewer */}
        {selectedMedia && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <div 
              className="relative max-w-4xl w-full bg-[#111111] rounded-2xl overflow-hidden border border-[#d4af37] shadow-[0_0_50px_rgba(0,0,0,0.95)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#080808] text-[#aaaaaa] hover:text-[#d4af37] border border-[#333333] transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="max-h-[70vh] flex items-center justify-center bg-black">
                <img
                  src={getMediaUrl(selectedMedia.media_url)}
                  alt={selectedMedia.title}
                  className="max-h-[70vh] w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/BG1.png';
                  }}
                />
              </div>

              <div className="p-6 bg-[#0c0c0c] border-t border-[#333333] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-cinzel font-bold text-lg text-[#d4af37]">
                    {selectedMedia.title}
                  </h3>
                  <p className="text-xs text-[#999999] capitalize font-outfit mt-0.5">
                    Category: {selectedMedia.category ? selectedMedia.category.replace('-', ' ') : 'Classical Gallery'}
                  </p>
                </div>
                <span className="font-cinzel text-xs text-[#d4af37] px-3 py-1 rounded border border-[#333333] bg-[#111111] self-start sm:self-auto">
                  Sri Ruthraalayaa
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
