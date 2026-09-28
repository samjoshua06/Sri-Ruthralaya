const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { z } = require('zod');
const { db, fallbackStore, getIsDbConnected, isProduction, recordAdminActivity, getAdminInfoFromReq } = require('../config/db');

const gallerySchema = z.object({
  title: z.string().min(2),
  media_url: z.string().min(1),
  category: z.string().default('performances'),
  media_type: z.enum(['image', 'video']).default('image'),
});

/**
 * Helper to ensure media is saved to cloud or local object storage
 * and NEVER stored as a huge Base64 string in PostgreSQL
 */
async function processMediaStorage(mediaUrl) {
  if (!mediaUrl) return '/BG1.png';

  // If already a clean relative or absolute URL, use it directly
  if (!mediaUrl.startsWith('data:')) {
    return mediaUrl;
  }

  // If Cloudinary URL is configured in environment
  if (process.env.CLOUDINARY_URL) {
    try {
      const cloudinary = require('cloudinary').v2;
      const uploadRes = await cloudinary.uploader.upload(mediaUrl, {
        folder: 'sri_ruthralaya_gallery',
        resource_type: 'auto',
      });
      return uploadRes.secure_url;
    } catch (err) {
      console.warn('ℹ️ Cloudinary upload deferred, falling back to local object storage:', err.message);
    }
  }

  // Save local cache copy to backend/public/uploads/gallery if filesystem allows
  try {
    const matches = mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('mp4')) ext = 'mp4';
      else if (mimeType.includes('jpeg')) ext = 'jpg';

      const filename = `gal-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      const uploadDir = path.join(__dirname, '../../public/uploads/gallery');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
    }
  } catch (err) {
    console.warn('Local file cache skipped:', err.message);
  }

  // Without Cloudinary, storing the optimized data URL directly in PostgreSQL ensures
  // photos remain permanently visible across Netlify, Render restarts, and ephemeral hosting.
  return mediaUrl;
}

/**
 * Dedicated Upload endpoint for media
 * POST /api/v1/gallery/upload
 */
async function uploadMedia(req, res, next) {
  try {
    const { media } = req.body;
    if (!media) {
      return res.status(400).json({ success: false, data: null, message: 'No media data provided.' });
    }

    const secureUrl = await processMediaStorage(media);
    return res.status(200).json({
      success: true,
      data: { url: secureUrl },
      message: 'Media stored successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all gallery media
 */
async function getGallery(req, res, next) {
  try {
    const { category, media_type } = req.query;
    const isDb = getIsDbConnected();

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (isDb) {
      const where = {};
      if (category && category !== 'all') where.category = category;
      if (media_type && media_type !== 'all') where.media_type = media_type;

      const items = await db.gallery.findMany({
        where,
        orderBy: { uploaded_at: 'desc' },
      });

      return res.status(200).json({ success: true, data: items, message: 'Gallery media retrieved.' });
    } else {
      let items = [...fallbackStore.gallery];
      if (category && category !== 'all') items = items.filter(g => g.category === category);
      if (media_type && media_type !== 'all') items = items.filter(g => g.media_type === media_type);

      return res.status(200).json({ success: true, data: items, message: 'Gallery media retrieved.' });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Upload / add gallery media (Admin only)
 */
async function addGalleryItem(req, res, next) {
  try {
    const validated = gallerySchema.parse(req.body);
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    // Process media URL to avoid storing massive Base64 strings in PostgreSQL
    validated.media_url = await processMediaStorage(validated.media_url);

    let createdItem;
    if (isDb) {
      createdItem = await db.gallery.create({
        data: validated,
      });
    } else {
      createdItem = {
        id: `gal-${Date.now()}`,
        ...validated,
        uploaded_at: new Date(),
        created_at: new Date(),
      };
      fallbackStore.gallery.unshift(createdItem);
    }

    // Record Admin Activity in DB
    await recordAdminActivity({
      ...adminInfo,
      action: 'UPLOAD_GALLERY',
      entity_type: 'gallery',
      entity_id: createdItem.id,
      title: 'Uploaded Gallery Media',
      details: `Uploaded photo "${validated.title}" to category "${validated.category}"`,
    });

    return res.status(201).json({ success: true, data: createdItem, message: 'Media item added to gallery.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete gallery media item (Admin only)
 */
async function deleteGalleryItem(req, res, next) {
  try {
    const { id } = req.params;
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    let deletedTitle = id;
    if (isDb) {
      const item = await db.gallery.findUnique({ where: { id } });
      if (item) deletedTitle = item.title;
      await db.gallery.delete({ where: { id } });
    } else {
      const idx = fallbackStore.gallery.findIndex(g => g.id === id);
      if (idx === -1) return res.status(404).json({ success: false, data: null, message: 'Item not found.' });
      deletedTitle = fallbackStore.gallery[idx].title || id;
      fallbackStore.gallery.splice(idx, 1);
    }

    // Record Admin Activity in DB
    await recordAdminActivity({
      ...adminInfo,
      action: 'DELETE_GALLERY',
      entity_type: 'gallery',
      entity_id: id,
      title: 'Deleted Gallery Media',
      details: `Removed gallery photo "${deletedTitle}"`,
    });

    return res.status(200).json({ success: true, data: null, message: 'Media item removed from gallery.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Update gallery media item (Admin only)
 */
async function updateGalleryItem(req, res, next) {
  try {
    const { id } = req.params;
    const validated = gallerySchema.partial().parse(req.body);
    const isDb = getIsDbConnected();
    const adminInfo = getAdminInfoFromReq(req);

    if (isProduction && !isDb) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    if (validated.media_url) {
      validated.media_url = await processMediaStorage(validated.media_url);
    }

    let updatedItem;
    if (isDb) {
      updatedItem = await db.gallery.update({
        where: { id },
        data: validated,
      });
    } else {
      const idx = fallbackStore.gallery.findIndex(g => g.id === id);
      if (idx === -1) return res.status(404).json({ success: false, data: null, message: 'Item not found.' });
      fallbackStore.gallery[idx] = { ...fallbackStore.gallery[idx], ...validated };
      updatedItem = fallbackStore.gallery[idx];
    }

    if (!updatedItem) {
      return res.status(404).json({ success: false, data: null, message: 'Item not found.' });
    }

    // Record Admin Activity in DB
    await recordAdminActivity({
      ...adminInfo,
      action: 'UPDATE_GALLERY',
      entity_type: 'gallery',
      entity_id: id,
      title: 'Updated Gallery Media',
      details: `Updated details for gallery photo "${updatedItem.title || validated.title || id}"`,
    });

    return res.status(200).json({ success: true, data: updatedItem, message: 'Gallery media updated.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGallery,
  addGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  uploadMedia,
};
