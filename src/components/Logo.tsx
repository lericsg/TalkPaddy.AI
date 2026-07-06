/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = '', size = 48 }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block transition-transform duration-300 ${className}`}
      id="talkpaddy-logo-icon"
    >
      <defs>
        {/* Exact brand gradient (violet to bright blue) */}
        <linearGradient id="logoGrad" x1="20" y2="100" x2="100" y1="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" /> {/* Indigo-600 */}
          <stop offset="50%" stopColor="#3b82f6" /> {/* Blue-500 */}
          <stop offset="100%" stopColor="#06b6d4" /> {/* Cyan-500 */}
        </linearGradient>
      </defs>

      {/* Sparkle 1: Top-left-most (smaller) */}
      <path
        d="M34 32 C35.5 32 36 31.5 36 30 C36 31.5 36.5 32 38 32 C36.5 32 36 32.5 36 34 C36 32.5 35.5 32 34 32 Z"
        fill="url(#logoGrad)"
        opacity="0.85"
      />

      {/* Sparkle 2: Main sparkle (larger) */}
      <path
        d="M42 18 C45 18 46 16.5 46 13.5 C46 16.5 47 18 50 18 C47 18 46 19.5 46 22.5 C46 19.5 45 18 42 18 Z"
        fill="url(#logoGrad)"
      />

      {/* Main speech bubble / document combo with top-right page fold */}
      {/* 
        Coords details:
        Main box: x=40 to x=102, y=28 to y=90
        Top-right cut: (90, 28) to (102, 40)
        Tail: bottom-left (40, 80) points down-left to (35, 94) and back to (48, 88)
      */}
      <path
        d="M 52 28 
           H 88 
           L 102 42 
           V 78 
           A 12 12 0 0 1 90 90 
           H 54
           C 51 90 46 93 40 96
           C 41 91 40 85 40 80
           A 12 12 0 0 1 52 28 Z"
        fill="url(#logoGrad)"
      />

      {/* Top-right folded page corner */}
      <path
        d="M 88 28 
           V 38 
           A 4 4 0 0 0 92 42 
           H 102 
           Z"
        fill="#ffffff"
        opacity="0.32"
      />

      {/* Central Microphone Icon (Left side) */}
      {/* Microphone main body */}
      <rect x="56" y="42" width="14" height="24" rx="7" fill="#ffffff" />
      
      {/* U-shaped outer stand */}
      <path
        d="M 51 53 
           V 55 
           A 19 19 0 0 0 75 55 
           V 53"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      
      {/* Stand base / stem */}
      <path
        d="M 63 64 
           V 72"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Bulleted List Details (Right side) */}
      {/* Item 1 */}
      <circle cx="83" cy="48" r="2.5" fill="#ffffff" />
      <rect x="89" y="46.5" width="10" height="3" rx="1.5" fill="#ffffff" />

      {/* Item 2 */}
      <circle cx="83" cy="57" r="2.5" fill="#ffffff" />
      <rect x="89" y="55.5" width="10" height="3" rx="1.5" fill="#ffffff" />

      {/* Item 3 */}
      <circle cx="83" cy="66" r="2.5" fill="#ffffff" />
      <rect x="89" y="64.5" width="10" height="3" rx="1.5" fill="#ffffff" />
    </svg>
  );
}

interface LogoFullProps {
  className?: string;
  variant?: 'horizontal' | 'vertical';
  iconSize?: number;
}

export function LogoFull({ className = '', variant = 'horizontal', iconSize }: LogoFullProps) {
  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`} id="talkpaddy-logo-full-vertical">
        <LogoIcon size={iconSize || 96} className="mb-4 hover:scale-105" />
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase font-sans">
          Talk<span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400">Paddy</span>
        </h1>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold font-sans mt-2">
          AI Meeting Recorder & Note Taker
        </p>
      </div>
    );
  }

  // Horizontal navbar variant
  return (
    <div className={`flex items-center gap-2.5 group select-none ${className}`} id="talkpaddy-logo-full-horizontal">
      <LogoIcon size={iconSize || 38} className="group-hover:scale-105" />
      <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-lg uppercase font-sans">
        Talk<span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400 font-black">Paddy</span>
      </span>
    </div>
  );
}
