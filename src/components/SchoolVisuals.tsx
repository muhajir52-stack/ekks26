import { useState } from 'react';
import { isRenderableImageUrl } from '../lib/imageUtils';

export function CampusHeroVisual({
  imageUrl,
  caption,
}: {
  imageUrl?: string;
  caption?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const showCustom = isRenderableImageUrl(imageUrl) && !imgError;

  if (showCustom) {
    return (
      <div className="relative w-full h-full min-h-[320px] rounded-2xl overflow-hidden bg-emerald-950 border border-emerald-800/30 flex flex-col justify-between">
        <img
          src={imageUrl}
          alt={caption || 'Foto Kampus SMA Darul Ulum Kepohbaru'}
          onError={() => setImgError(true)}
          className="w-full h-full min-h-[270px] max-h-[380px] object-cover flex-1"
        />
        <div className="px-5 py-3.5 bg-emerald-950/95 flex items-center justify-between text-xs text-emerald-100/90 border-t border-emerald-800/60">
          <span className="truncate pr-3">{caption || 'Kampus Terpadu SMA Darul Ulum Kepohbaru'}</span>
          <span className="font-tabular shrink-0">Kepohbaru · Bojonegoro</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[320px] rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 border border-emerald-800/40 flex flex-col justify-between p-6 text-white">
      <svg
        viewBox="0 0 640 360"
        className="w-full h-full object-contain"
        role="img"
        aria-label="Ilustrasi Arsitektur Kampus SMA Darul Ulum Kepohbaru"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#064e3b" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id="sunGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <rect width="640" height="360" rx="16" fill="url(#skyGrad)" />
        {/* Geometric Islamic lattice subtle backdrop */}
        <g stroke="#a7f3d0" strokeOpacity="0.1" strokeWidth="1" fill="none">
          <circle cx="520" cy="82" r="56" />
          <circle cx="520" cy="82" r="40" />
          <path d="M464 82 L576 82 M520 26 L520 138 M480 42 L560 122 M560 42 L480 122" />
        </g>
        <circle cx="520" cy="82" r="24" fill="url(#sunGlow)" />
        {/* Ground & Courtyard */}
        <rect x="0" y="278" width="640" height="82" fill="#022c22" />
        <rect x="40" y="286" width="560" height="10" rx="5" fill="#065f46" />
        {/* Main School Building */}
        <rect x="90" y="148" width="460" height="130" rx="4" fill="#ecfdf5" />
        <rect x="90" y="148" width="460" height="12" fill="#065f46" />
        {/* Center Dome / Islamic Roof Accent */}
        <path d="M260 148 Q320 92 380 148 Z" fill="#047857" />
        <path d="M320 82 L320 96" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <circle cx="320" cy="80" r="4" fill="#fbbf24" />
        {/* Center Portico */}
        <rect x="266" y="160" width="108" height="118" fill="#d1fae5" />
        <rect x="296" y="218" width="48" height="60" rx="2" fill="#064e3b" />
        {/* Arched Islamic Windows */}
        {[120, 165, 210, 400, 445, 490].map((x) => (
          <g key={x}>
            <path d={`M${x} 195 Q${x + 13} 178 ${x + 26} 195 L${x + 26} 218 L${x} 218 Z`} fill="#0f766e" />
            <rect x={x} y="232" width="26" height="28" rx="2" fill="#0f766e" />
          </g>
        ))}
        {/* Trees */}
        <circle cx="56" cy="238" r="28" fill="#10b981" fillOpacity="0.85" />
        <rect x="53" y="252" width="6" height="28" fill="#78350f" />
        <circle cx="584" cy="242" r="24" fill="#059669" fillOpacity="0.85" />
        <rect x="581" y="254" width="6" height="26" fill="#78350f" />
      </svg>
      <div className="pt-4 flex items-center justify-between text-xs text-emerald-100/90 border-t border-emerald-700/50">
        <span>{caption || 'Kampus Terpadu SMA Darul Ulum Kepohbaru'}</span>
        <span className="font-tabular">Kepohbaru · Bojonegoro</span>
      </div>
    </div>
  );
}

export function PrincipalAvatarVisual({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name
    .split(' ')
    .filter((p) => p.length > 0 && !p.includes('.'))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  if (isRenderableImageUrl(imageUrl) && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="w-20 h-20 rounded-xl object-cover shrink-0 border border-emerald-700/30 bg-slate-100"
      />
    );
  }

  return (
    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-900 to-emerald-700 text-white flex items-center justify-center font-editorial text-2xl font-semibold shrink-0 border border-emerald-600/30">
      {initials || 'KS'}
    </div>
  );
}

export function EditorialCardVisual({
  variant,
  imageUrl,
  alt,
}: {
  variant: 'academic' | 'culture' | 'partner';
  imageUrl?: string;
  alt?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const bgMap = {
    academic: 'from-emerald-900 to-teal-800',
    culture: 'from-slate-800 to-emerald-950',
    partner: 'from-amber-900 to-emerald-950',
  };

  if (isRenderableImageUrl(imageUrl) && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={alt || 'Dokumentasi SMA Darul Ulum Kepohbaru'}
        onError={() => setImgError(true)}
        className="w-full aspect-[16/9] rounded-lg object-cover border border-slate-200 bg-slate-100"
      />
    );
  }

  return (
    <div className={`w-full aspect-[16/9] rounded-lg bg-gradient-to-br ${bgMap[variant]} p-4 flex items-end justify-between text-white/90`}>
      <svg viewBox="0 0 120 40" className="w-28 h-10 opacity-40" aria-hidden="true">
        <path d="M4 36 L24 12 L44 36 M34 36 L62 6 L90 36 M74 36 L98 16 L116 36" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <span className="text-[11px] font-tabular tracking-wide opacity-80">SMA DU KEPOHBARU</span>
    </div>
  );
}
