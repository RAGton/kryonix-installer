import React from 'react';
import './Background3D.css';

export default function Background3D() {
  return (
    <div className="bg-3d-container">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className={`triangle-3d t-${i}`}>
          <div className="triangle-inner" />
        </div>
      ))}
    </div>
  );
}
