import React, { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Upload, 
  ExternalLink,
  Filter,
  Eye,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getMediaUrl, optimizeImageFile } from '../../utils/media';

export default function AdminGallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'performances',
    media_url: '',
    media_type: 'image',
  });
  const [imagePreview, setImagePreview] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    loadGallery();
  }, [activeCategory]);

  async function loadGallery() {
    setLoading(true);
    try {
      const url = activeCategory === 'all' ? '/gallery' : `/gallery?category=${activeCategory}`;
      const res = await api.get(url);
      if (res.data.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error('Error loading gallery:', err);
    } finally {
      setLoading(false);
    }
  }

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({
      title: '',
      category: 'performances',
      media_url: '/BG1.png',
      media_type: 'image',
    });
    setImagePreview('/BG1.png');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      category: item.category || 'performances',
      media_url: item.media_url || '',
      media_type: item.media_type || 'image',
    });
    setImagePreview(item.media_url || '');
    setModalOpen(true);
  };

  // Handle Submit (Create or Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.media_url) {
      alert('Please upload an image or provide an image URL.');
      return;
    }

    try {
      if (editingItem) {
        // Edit
        const res = await api.put(`/gallery/${editingItem.id}`, form);
        if (res.data.success) {
          setModalOpen(false);
          await loadGallery();
        }
      } else {
        // Create
        const res = await api.post('/gallery', form);
        if (res.data.success) {
          setModalOpen(false);
          await loadGallery();
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save media item.');
    }
  };

  // Handle Delete
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title || 'this image'}" from the gallery?`)) return;
    try {
      await api.delete(`/gallery/${id}`);
      await loadGallery();
    } catch (err) {
      alert('Failed to delete item.');
    }
  };

  // Handle File Upload from device (up to 15MB limit)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Image file is too large (maximum 15MB). Please choose a photo under 15MB.');
      return;
    }

    try {
      setIsOptimizing(true);
      const optimizedData = await optimizeImageFile(file, 1920, 0.88);
      setForm((prev) => ({ ...prev, media_url: optimizedData }));
      setImagePreview(optimizedData);
    } catch (err) {
      console.warn('Canvas optimization fallback, using direct reader:', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, media_url: reader.result }));
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsOptimizing(false);
    }
  };

  const categories = [
    { id: 'all', name: 'All Gallery Media' },
    { id: 'performances', name: 'Stage Performances' },
    { id: 'arangetram', name: 'Arangetrams' },
    { id: 'salangai-pooja', name: 'Salangai Pooja' },
    { id: 'classroom', name: 'Classroom & Sadhana' },
  ];

  return (
    <div className="space-y-6 font-outfit text-white">
      
      {/* Header with Title & Quick Public View Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#111111] border border-[#333333] shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-white">
              Photo Gallery &amp; <span className="text-[#d4af37]">Media Studio</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-cinzel font-bold bg-[#0f0f0f] text-[#d4af37] border border-[#333333]">
              Admin Upload Studio
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1">
            Upload and curate performance photography, Arangetram debuts, and Salangai Poojas displayed on the public gallery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/gallery"
            target="_blank"
            className="secondary-btn text-xs flex items-center gap-1.5"
          >
            <span>View Public Gallery</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={handleOpenCreate}
            className="primary-btn text-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Image</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#222222] pb-3">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-cinzel font-semibold transition-all ${
              activeCategory === c.id
                ? 'bg-[#d4af37] text-[#111111] shadow'
                : 'bg-[#111111] text-[#bdbdbd] border border-[#333333] hover:border-[#d4af37] hover:text-[#d4af37]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Gallery Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-3xl bg-[#111111] border border-[#333333] shadow-xl overflow-hidden flex flex-col justify-between group hover:border-[#d4af37]/60 transition-all"
          >
            <div className="h-60 bg-[#0f0f0f] relative overflow-hidden">
              <img
                src={getMediaUrl(item.media_url)}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/BG1.png';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {/* Category Badge */}
              <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-[#0f0f0f]/90 text-[#d4af37] border border-[#333333] text-[10px] font-cinzel uppercase font-bold shadow">
                {item.category?.replace('-', ' ')}
              </span>

              {/* Top Action Buttons (Edit + Delete) */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-2 rounded-xl bg-[#0f0f0f]/90 text-[#d4af37] hover:bg-[#d4af37] hover:text-[#111111] border border-[#333333] transition-all shadow-md"
                  title="Edit Photo"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item.id, item.title)}
                  className="p-2 rounded-xl bg-red-950/80 text-red-300 hover:bg-red-900 border border-red-900/40 transition-all shadow-md"
                  title="Delete Photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#111111] flex items-center justify-between border-t border-[#222222]">
              <div className="overflow-hidden">
                <h3 className="font-cinzel font-bold text-sm text-white truncate">
                  {item.title}
                </h3>
                <span className="text-[10px] text-[#888888] font-outfit mt-0.5 block truncate">
                  Uploaded to {item.category}
                </span>
              </div>

              <button
                onClick={() => handleOpenEdit(item)}
                className="text-xs font-cinzel font-bold text-[#d4af37] hover:underline flex items-center gap-1 flex-shrink-0"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && !loading && (
          <div className="col-span-full p-12 bg-[#111111] rounded-3xl border border-dashed border-[#333333] text-center space-y-3">
            <ImageIcon className="w-12 h-12 text-[#666666] mx-auto" />
            <h3 className="font-cinzel font-bold text-lg text-white">No Gallery Photos in this Category</h3>
            <p className="text-xs text-[#888888]">Click "Upload New Image" above to upload photos from your device.</p>
          </div>
        )}
      </div>

      {/* Upload / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111111] rounded-3xl border border-[#d4af37] max-w-md w-full p-6 sm:p-8 shadow-2xl relative my-8 text-white">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#222222] text-[#888888] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-cinzel font-bold text-xl text-[#d4af37] mb-1">
              {editingItem ? 'Edit Gallery Photo' : 'Upload Gallery Photo'}
            </h3>
            <p className="text-xs text-[#bdbdbd] font-outfit mb-5">
              Upload classical Bharatanatyam photos to publish instantly onto the public gallery.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 font-outfit">
              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">
                  Photo Caption / Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Navarasa Abhinaya in Varnam Solo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#333333] text-xs sm:text-sm focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">
                  Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#333333] text-xs sm:text-sm focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-white"
                >
                  <option value="performances">Stage Performances &amp; Utsavs</option>
                  <option value="arangetram">Arangetram Solo Debuts</option>
                  <option value="salangai-pooja">Salangai Pooja Ceremony</option>
                  <option value="classroom">Classroom &amp; Practice Drills</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">
                  Upload Image from Device or Enter URL *
                </label>
                
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={form.media_url}
                      onChange={(e) => {
                        setForm({ ...form, media_url: e.target.value });
                        setImagePreview(e.target.value);
                      }}
                      placeholder="Paste image URL or pick file"
                      className="flex-grow px-3.5 py-2.5 rounded-xl border border-[#333333] text-xs focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-white"
                    />

                    <label className={`cursor-pointer px-3.5 py-2.5 rounded-xl bg-[#0f0f0f] hover:bg-[#1a1a1a] border border-[#333333] text-[#d4af37] text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-colors ${isOptimizing ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      {isOptimizing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                          <span>Optimizing...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Choose File</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isOptimizing}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <p className="text-[11px] text-[#888888]">
                    Max file size: <span className="text-[#d4af37] font-semibold">15MB</span> (automatically optimized for high performance &amp; HD display).
                  </p>

                  {/* Brand Presets */}
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-[10px] text-[#777777] self-center">Brand Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, media_url: '/BG1.png' });
                        setImagePreview('/BG1.png');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] bg-[#0f0f0f] border border-[#333333] text-[#bdbdbd] hover:border-[#d4af37]"
                    >
                      Nataraja BG1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, media_url: '/BG.2.png' });
                        setImagePreview('/BG.2.png');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] bg-[#0f0f0f] border border-[#333333] text-[#bdbdbd] hover:border-[#d4af37]"
                    >
                      Salangai BG2
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, media_url: '/logo.png' });
                        setImagePreview('/logo.png');
                      }}
                      className="px-2 py-0.5 rounded text-[10px] bg-[#0f0f0f] border border-[#333333] text-[#bdbdbd] hover:border-[#d4af37]"
                    >
                      Logo Emblem
                    </button>
                  </div>

                  {/* Live Preview Box */}
                  {imagePreview && (
                    <div className="h-36 w-full rounded-xl overflow-hidden border border-[#d4af37]/40 bg-[#0a0a0a] relative mt-2">
                      <img
                        src={getMediaUrl(imagePreview)}
                        alt="Preview"
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/BG1.png';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="secondary-btn text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn text-xs py-2 px-5"
                >
                  {editingItem ? 'Save Changes' : 'Upload to Gallery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
