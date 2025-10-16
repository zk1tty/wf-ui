import React from 'react';

interface DotsBackgroundProps {
  theme: 'light' | 'dark';
}

export function DotsBackground({ theme }: DotsBackgroundProps) {
  // Theme tokens matching the step setting card
  const styles = theme === 'dark' 
    ? {
        bg: '#0f1216',              // Canvas base (close to panel)
        panel: '#151922',           // Card background ref
        hairline: 'rgba(255,255,255,.08)',
        dotRgb: '255,255,255',      // White dots but low alpha
        dotAlpha: '0.08',           // Main dots
        dot2Alpha: '0.035',         // Secondary dots (sparser)
        dotSize: '0.62',            // r in px
        dotStep: '24',              // Spacing in px
        dot2Step: '48',             // Spacing in px (sparser)
      }
    : {
        bg: '#f9fafb',              // Light canvas base
        panel: '#ffffff',           // Light card background
        hairline: 'rgba(0,0,0,.08)',
        dotRgb: '0,0,0',            // Black dots for light mode
        dotAlpha: '0.08',           // Main dots
        dot2Alpha: '0.035',         // Secondary dots
        dotSize: '0.62',            // r in px
        dotStep: '24',              // Spacing in px
        dot2Step: '48',             // Spacing in px
      };

  return (
    <svg
      className="react-flow__background"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Main scale dots */}
        <pattern 
          id="dots-1" 
          width={styles.dotStep} 
          height={styles.dotStep} 
          patternUnits="userSpaceOnUse"
        >
          <circle 
            cx="1.5" 
            cy="1.5" 
            r={styles.dotSize} 
            fill={`rgba(${styles.dotRgb}, ${styles.dotAlpha})`} 
          />
        </pattern>
        
        {/* Optional sparser scale for depth */}
        <pattern 
          id="dots-2" 
          width={styles.dot2Step} 
          height={styles.dot2Step} 
          patternUnits="userSpaceOnUse"
        >
          <circle 
            cx="1.5" 
            cy="1.5" 
            r={styles.dotSize} 
            fill={`rgba(${styles.dotRgb}, ${styles.dot2Alpha})`} 
          />
        </pattern>
      </defs>

      {/* Base background */}
      <rect width="100%" height="100%" fill={styles.bg} />
      
      {/* Sparser dots layer */}
      <rect width="100%" height="100%" fill="url(#dots-2)" />
      
      {/* Main dots layer */}
      <rect width="100%" height="100%" fill="url(#dots-1)" />
    </svg>
  );
}

