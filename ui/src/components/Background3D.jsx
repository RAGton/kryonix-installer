import React from 'react';

export default function Background3D() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-40 transition-opacity duration-500">
      {/* Soft gradient orb 1 */}
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-accent-blue/20 blur-[120px] mix-blend-screen" />
      {/* Soft gradient orb 2 */}
      <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-accent-cyan/10 blur-[140px] mix-blend-screen" />
      {/* Noise overlay for texture (optional) */}
      <div className="absolute inset-0 bg-noise opacity-[0.015] mix-blend-overlay"></div>
    </div>
  );
}
