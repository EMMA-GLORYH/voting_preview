'use client';

import React, { useState } from 'react';
import { getCandidatePhoto } from '@/lib/candidate-portraits';

interface CandidateAvatarProps {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

export function CandidateAvatar({ name, photoUrl, size = '3xl', className = '' }: CandidateAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const effectiveUrl = getCandidatePhoto(name, photoUrl);

  const dimensionClasses = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-base',
    xl: 'w-24 h-24 sm:w-28 sm:h-28 text-xl',
    '2xl': 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 text-2xl',
    '3xl': 'w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 text-3xl',
  }[size];

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      className={`rounded-3xl overflow-hidden bg-slate-800 shrink-0 border-2 border-white/30 shadow-xl flex items-center justify-center ${dimensionClasses} ${className}`}
    >
      {!imageError && effectiveUrl ? (
        <img
          src={effectiveUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-black font-mono tracking-wider select-none text-base sm:text-lg">
          {initials || 'C'}
        </div>
      )}
    </div>
  );
}
