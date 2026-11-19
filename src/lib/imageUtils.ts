import type { SchoolContent } from '../types/sims';

export interface SiteVisualSlot {
  key: 'logo_sekolah' | 'hero_kampus' | 'foto_kepala_sekolah' | 'banner_profil' | 'banner_ppdb';
  label: string;
  locationHint: string;
  recommendedSize: string;
  maxWidth: number;
  maxHeight: number;
  defaultCaption: string;
}

export const SITE_VISUAL_SLOTS: SiteVisualSlot[] = [
  {
    key: 'logo_sekolah',
    label: 'Logo / Lambang Sekolah',
    locationHint: 'Header Website Publik & Sidebar Portal SIMS',
    recommendedSize: 'Rasio 1:1 (mis. 400 × 400 px)',
    maxWidth: 400,
    maxHeight: 400,
    defaultCaption: 'Logo SMA Darul Ulum Kepohbaru',
  },
  {
    key: 'hero_kampus',
    label: 'Foto / Banner Kampus Utama',
    locationHint: 'Bagian Atas Halaman Beranda Website Publik',
    recommendedSize: 'Rasio 16:9 / 4:3 (maks 1200 × 800 px)',
    maxWidth: 1200,
    maxHeight: 800,
    defaultCaption: 'Kampus Terpadu SMA Darul Ulum Kepohbaru',
  },
  {
    key: 'foto_kepala_sekolah',
    label: 'Foto Kepala Sekolah',
    locationHint: 'Kartu Sambutan Kepala Sekolah di Beranda',
    recommendedSize: 'Rasio 1:1 (mis. 400 × 400 px)',
    maxWidth: 450,
    maxHeight: 450,
    defaultCaption: 'Kepala SMA Darul Ulum Kepohbaru',
  },
  {
    key: 'banner_profil',
    label: 'Foto Halaman Profil & Sejarah',
    locationHint: 'Halaman Profil Institusi Website Publik',
    recommendedSize: 'Rasio 16:9 (maks 1200 × 700 px)',
    maxWidth: 1200,
    maxHeight: 700,
    defaultCaption: 'Lingkungan Belajar SMA Darul Ulum Kepohbaru',
  },
  {
    key: 'banner_ppdb',
    label: 'Poster / Banner Informasi PPDB',
    locationHint: 'Halaman PPDB & Kontak Website Publik',
    recommendedSize: 'Rasio 16:9 atau 4:3 (maks 1200 × 900 px)',
    maxWidth: 1200,
    maxHeight: 900,
    defaultCaption: 'Penerimaan Peserta Didik Baru SMA Darul Ulum Kepohbaru',
  },
];

export type SiteVisualKey = SiteVisualSlot['key'];

export interface SiteVisualEntry {
  url: string;
  caption: string;
}

export function parseSiteVisuals(
  doc?: Pick<SchoolContent, 'items'> | null
): Record<SiteVisualKey, SiteVisualEntry> {
  const result: Record<SiteVisualKey, SiteVisualEntry> = {
    logo_sekolah: { url: '', caption: SITE_VISUAL_SLOTS[0].defaultCaption },
    hero_kampus: { url: '', caption: SITE_VISUAL_SLOTS[1].defaultCaption },
    foto_kepala_sekolah: { url: '', caption: SITE_VISUAL_SLOTS[2].defaultCaption },
    banner_profil: { url: '', caption: SITE_VISUAL_SLOTS[3].defaultCaption },
    banner_ppdb: { url: '', caption: SITE_VISUAL_SLOTS[4].defaultCaption },
  };

  if (!doc?.items) return result;
  for (const item of doc.items) {
    const key = item.label as SiteVisualKey;
    if (key in result) {
      result[key] = {
        url: item.value || '',
        caption: item.description || result[key].caption,
      };
    }
  }
  return result;
}

export function isRenderableImageUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  );
}

export async function compressImageFile(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxChars?: number;
  } = {}
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Berkas harus berupa gambar (JPG, PNG, atau WebP).');
  }

  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 800;
  const maxChars = options.maxChars ?? 160000;
  let quality = options.quality ?? 0.82;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Gagal membaca berkas gambar.'));
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Format gambar tidak dapat diproses oleh browser.'));
    el.src = dataUrl;
  });

  let targetW = img.naturalWidth || img.width;
  let targetH = img.naturalHeight || img.height;
  const scale = Math.min(1, maxWidth / Math.max(1, targetW), maxHeight / Math.max(1, targetH));
  targetW = Math.max(1, Math.round(targetW * scale));
  targetH = Math.max(1, Math.round(targetH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas browser tidak tersedia untuk mengolah gambar.');
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);

  const mimeType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  let output = canvas.toDataURL(mimeType, quality);
  if (!output.startsWith('data:image/')) {
    output = canvas.toDataURL('image/jpeg', quality);
  }

  while (output.length > maxChars && quality > 0.35) {
    quality -= 0.1;
    output = canvas.toDataURL('image/jpeg', quality);
  }

  if (output.length > maxChars) {
    // Downscale once more to guarantee it fits comfortably within Firestore bounds
    const shrinkCanvas = document.createElement('canvas');
    shrinkCanvas.width = Math.max(1, Math.round(targetW * 0.7));
    shrinkCanvas.height = Math.max(1, Math.round(targetH * 0.7));
    const sCtx = shrinkCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(canvas, 0, 0, shrinkCanvas.width, shrinkCanvas.height);
      output = shrinkCanvas.toDataURL('image/jpeg', 0.7);
    }
  }

  if (output.length > maxChars) {
    throw new Error(
      'Ukuran gambar masih terlalu besar setelah kompresi. Gunakan gambar dengan resolusi lebih kecil atau tautan URL.'
    );
  }

  return output;
}
