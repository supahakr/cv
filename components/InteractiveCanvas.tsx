import React, { useRef, useEffect, useState, MouseEvent } from 'react';
import { Point } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface InteractiveCanvasProps {
  image: HTMLCanvasElement | HTMLImageElement | null;
  points: Point[];
  maxPoints: number;
  onAddPoint: (p: Point) => void;
  label: string;
  active: boolean;
  color?: string; // Marker color, default red
}

const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  image,
  points,
  maxPoints,
  onAddPoint,
  label,
  active,
  color = 'red',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Tracks movement delta
  const [initialized, setInitialized] = useState(false);
  
  // Store the absolute start position of the click to distinguish from drag
  const clickStartRef = useRef({ x: 0, y: 0 });

  // Fit image to container
  const fitToContainer = () => {
    if (!image || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const scaleW = width / image.width;
    const scaleH = height / image.height;
    
    // Fit entire image with a small margin (95% fit)
    const startScale = Math.min(scaleW, scaleH) * 0.95;
    
    const displayW = image.width * startScale;
    const displayH = image.height * startScale;
    
    setScale(startScale);
    setOffset({
      x: (width - displayW) / 2,
      y: (height - displayH) / 2,
    });
    setInitialized(true);
  };

  // Initial fit and Resize Observer
  useEffect(() => {
    if (!image) return;
    setInitialized(false);
    fitToContainer();

    const resizeObserver = new ResizeObserver(() => {
        if (!initialized) {
            fitToContainer();
        }
    });

    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [image]);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas size to container for high DPI
    const rect = containerRef.current.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Image
    if (image) {
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    } else {
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillText("No Image", canvas.width/2, canvas.height/2);
    }

    // Draw Markers
    points.forEach((p, idx) => {
      // Convert image coords to screen coords
      const screenX = p.x * scale + offset.x;
      const screenY = p.y * scale + offset.y;

      const radius = 8;
      const crossSize = 12;

      ctx.save();
      
      // Circle
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fill();

      // Crosshair
      ctx.beginPath();
      ctx.moveTo(screenX - crossSize, screenY);
      ctx.lineTo(screenX + crossSize, screenY);
      ctx.moveTo(screenX, screenY - crossSize);
      ctx.lineTo(screenX, screenY + crossSize);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Number Background
      ctx.fillStyle = 'black';
      ctx.fillRect(screenX + 10, screenY - 20, 20, 20);

      // Number
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${idx + 1}`, screenX + 20, screenY - 10);

      // Coords
      ctx.fillStyle = 'yellow';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(`(${Math.round(p.x)}, ${Math.round(p.y)})`, screenX + 10, screenY + 15);

      ctx.restore();
    });

  }, [image, points, scale, offset, color, containerRef.current?.getBoundingClientRect().width]);

  // Event Handlers
  const handleZoom = (direction: 'in' | 'out') => {
    if (!containerRef.current) return;
    const factor = direction === 'in' ? 1.2 : 0.8;
    const newScale = Math.max(0.01, Math.min(50, scale * factor));
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const imagePointX = (centerX - offset.x) / scale;
    const imagePointY = (centerY - offset.y) / scale;

    const newOffsetX = centerX - imagePointX * newScale;
    const newOffsetY = centerY - imagePointY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const handleReset = () => {
    fitToContainer();
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    // Calculate total distance moved since mouse down
    const totalDx = e.clientX - clickStartRef.current.x;
    const totalDy = e.clientY - clickStartRef.current.y;
    const dist = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

    // If movement is very small, consider it a click
    if (dist < 5 && active && image && canvasRef.current) {
        // Enforce Max Points
        if (points.length < maxPoints) {
            const rect = canvasRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const imgX = (clickX - offset.x) / scale;
            const imgY = (clickY - offset.y) / scale;

            // Bounds check
            if (imgX >= 0 && imgX <= image.width && imgY >= 0 && imgY <= image.height) {
                onAddPoint({ x: imgX, y: imgY });
            }
        }
    }

    setIsDragging(false);
  };

  return (
    <div className="relative flex flex-col h-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <div className="absolute top-2 left-2 z-10 bg-black/70 text-white px-2 py-1 rounded text-sm font-bold pointer-events-none">
            {label}
        </div>
        
        {/* Controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-2">
            <button 
                onClick={() => handleZoom('in')}
                className="p-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 shadow-lg border border-gray-600"
                title="Zoom In"
            >
                <ZoomIn size={18} />
            </button>
            <button 
                onClick={() => handleZoom('out')}
                className="p-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 shadow-lg border border-gray-600"
                title="Zoom Out"
            >
                <ZoomOut size={18} />
            </button>
             <button 
                onClick={handleReset}
                className="p-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 shadow-lg border border-gray-600"
                title="Fit View"
            >
                <Maximize size={18} />
            </button>
        </div>

        <div 
            ref={containerRef} 
            className={`flex-1 overflow-hidden cursor-${active ? 'crosshair' : 'move'} touch-none`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDragging(false)}
        >
            <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
        
        <div className="bg-gray-800 px-3 py-1 text-xs text-gray-400 flex justify-between">
           <span>{image ? `${image.width} x ${image.height}` : 'No Image'}</span>
           <span>Zoom: {(scale * 100).toFixed(0)}%</span>
        </div>
    </div>
  );
};

export default InteractiveCanvas;