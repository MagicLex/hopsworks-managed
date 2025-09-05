import React, { useEffect, useRef, useState } from 'react';

const PixelBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixels, setPixels] = useState<{ x: number; y: number; shade: number }[]>([]);
  const [waveOffset, setWaveOffset] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  
  const PIXEL_SIZE = 100;
  const BASE_COLORS = [
    '#fafafa', // 0 - lightest
    '#f6f6f6', // 1
    '#f2f2f2', // 2
    '#eeeeee', // 3
    '#eaeaea'  // 4 - darkest
  ];
  
  useEffect(() => {
    const updatePixels = () => {
      if (!containerRef.current) return;
      
      const width = window.innerWidth;
      const height = window.innerHeight - 56; // Subtract navbar height
      const cols = Math.ceil(width / PIXEL_SIZE);
      const rows = Math.ceil(height / PIXEL_SIZE);
      
      const newPixels = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Create a triangular wave pattern that rises and falls
          // Pattern: 4,5,6,7,8,7,6,5,4,3,2,1,0,0,0...
          
          // Create vertical columns with zigzag weaving effect
          // Ping-pong the offset: +1, +2, +1, 0, -1, -2, -1, 0, repeat...
          const zigzagPeriod = 8;
          const zigzagPosition = row % zigzagPeriod;
          let rowOffset;
          if (zigzagPosition < 2) rowOffset = zigzagPosition + 1; // 1, 2
          else if (zigzagPosition < 4) rowOffset = 4 - zigzagPosition; // 2, 1
          else if (zigzagPosition < 6) rowOffset = 4 - zigzagPosition; // 0, -1
          else rowOffset = zigzagPosition - 8; // -2, -1
          
          // Start the wave from the left side
          const waveFromLeft = col + rowOffset * 0.5 + waveOffset;
          
          // Create a gradient that starts dark on the left and fades right
          const fadeAcross = Math.max(0, 1 - (col / cols) * 2);
          
          // Simple wave that originates from left
          const waveIntensity = Math.sin(waveFromLeft * 0.3) * 2 + 2;
          const distanceFromLeft = col;
          
          // Calculate shade - darker on left, lighter on right
          // Combined with wave for organic feel
          let shade = Math.floor(waveIntensity * fadeAcross);
          
          // Add subtle variation to soften the pattern
          const subtle = Math.sin(row * 0.15) * 0.3;
          
          // Final shade calculation
          shade = Math.round(shade + subtle);
          
          newPixels.push({
            x: col * PIXEL_SIZE,
            y: row * PIXEL_SIZE,
            shade: Math.min(4, Math.max(0, shade))
          });
        }
      }
      setPixels(newPixels);
    };
    
    updatePixels();
    window.addEventListener('resize', updatePixels);
    return () => window.removeEventListener('resize', updatePixels);
  }, [waveOffset]); // Re-render when waveOffset changes
  
  // Animate the wave pattern with ping-pong effect
  useEffect(() => {
    const animateWave = () => {
      setWaveOffset(prev => {
        const newOffset = prev + (0.05 * direction);
        
        // Reverse direction at boundaries
        if (newOffset > 2 || newOffset < -2) {
          setDirection(d => -d);
          return prev + (0.05 * -direction);
        }
        
        return newOffset;
      });
    };
    
    const interval = setInterval(animateWave, 100); // Update every 100ms
    
    return () => clearInterval(interval);
  }, [direction]);
  
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: '#fafafa', top: '56px' }}
    >
      {pixels.map((pixel, index) => (
        <div
          key={index}
          className="absolute transition-colors duration-1000 ease-in-out"
          style={{
            left: pixel.x,
            top: pixel.y,
            width: PIXEL_SIZE,
            height: PIXEL_SIZE,
            backgroundColor: BASE_COLORS[pixel.shade],
          }}
        />
      ))}
    </div>
  );
};

export default PixelBackground;