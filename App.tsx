import React, { useState } from 'react';
import { RotateCw, Scaling, Crop, CheckCircle, ArrowRight, Undo2, RotateCcw, Download, ImagePlus, FileImage } from 'lucide-react';
import InteractiveCanvas from './components/InteractiveCanvas';
import { loadImage, rotateImage, scaleImage, cropImagesAligned, mergeSideBySide, calculateAngle } from './services/imageService';
import { Point, AppStep, ProcessingOptions } from './types';

const App: React.FC = () => {
  // State
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  
  // Source images (kept through pipeline)
  const [srcL, setSrcL] = useState<HTMLCanvasElement | null>(null);
  const [srcR, setSrcR] = useState<HTMLCanvasElement | null>(null);

  // Current working canvases for the current step
  const [canvasL, setCanvasL] = useState<HTMLCanvasElement | null>(null);
  const [canvasR, setCanvasR] = useState<HTMLCanvasElement | null>(null);

  // Points for current operation
  const [pointsL, setPointsL] = useState<Point[]>([]);
  const [pointsR, setPointsR] = useState<Point[]>([]);

  // History tracking for undo: stores 'left' or 'right' indicating where the last point was added
  const [pointHistory, setPointHistory] = useState<('left' | 'right')[]>([]);

  // Config
  const [options, setOptions] = useState<ProcessingOptions>({
    assumeEqualTilt: false,
    assumeEqualZoom: false,
    assumeEqualFraming: false,
    rotateLeftImage: false,
  });

  // Result
  const [resultCanvas, setResultCanvas] = useState<HTMLCanvasElement | null>(null);
  const [quality, setQuality] = useState(90);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const processFile = async (file: File, side: 'left' | 'right') => {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      if (side === 'left') {
        setSrcL(canvas);
        setCanvasL(canvas); 
      } else {
        setSrcR(canvas);
        setCanvasR(canvas); 
      }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'left' | 'right') => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0], side);
    }
  };

  const handleDrop = async (e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await processFile(e.dataTransfer.files[0], side);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleAddPoint = (side: 'left' | 'right', p: Point) => {
      if (side === 'left') {
          setPointsL(prev => [...prev, p]);
      } else {
          setPointsR(prev => [...prev, p]);
      }
      setPointHistory(prev => [...prev, side]);
  };

  const undoLastPoint = () => {
      if (pointHistory.length === 0) return;
      
      const lastSide = pointHistory[pointHistory.length - 1];
      const newHistory = pointHistory.slice(0, -1);
      setPointHistory(newHistory);

      if (lastSide === 'left') {
          setPointsL(prev => prev.slice(0, -1));
      } else {
          setPointsR(prev => prev.slice(0, -1));
      }
  };

  const clearPoints = () => {
      setPointsL([]);
      setPointsR([]);
      setPointHistory([]);
  };

  const startProcessing = () => {
    if (!srcL || !srcR) return;

    if (options.assumeEqualFraming) {
        // Skip all, go to merge
        const merged = mergeSideBySide(srcL, srcR);
        setResultCanvas(merged);
        setStep(AppStep.RESULT);
        return;
    }

    if (options.assumeEqualTilt) {
        if (options.assumeEqualZoom) {
            setStep(AppStep.CROP);
        } else {
            setStep(AppStep.SCALE);
        }
    } else {
        setStep(AppStep.ROTATE);
    }
    
    // Reset points
    clearPoints();
  };

  const applyRotation = () => {
    if (!canvasL || !canvasR || pointsL.length < 2 || pointsR.length < 2) return;

    const angleL = calculateAngle(pointsL[0], pointsL[1]);
    const angleR = calculateAngle(pointsR[0], pointsR[1]);
    const diff = angleL - angleR; // if rotating R to match L.
    
    // Logic: rotate target to match ref.
    // If rotateRightImage (default true, so options.rotateLeftImage is false):
    // Ref is Left. Target is Right.
    // Right should rotate by diff.
    
    let nextL = canvasL;
    let nextR = canvasR;

    if (options.rotateLeftImage) {
       // Rotate Left to match Right
       // Target L, Ref R.
       // Diff = AngleR - AngleL
       const rotation = angleR - angleL;
       nextL = rotateImage(canvasL, rotation);
    } else {
       // Rotate Right to match Left (Default)
       nextR = rotateImage(canvasR, diff);
    }

    setCanvasL(nextL);
    setCanvasR(nextR);
    clearPoints();

    if (options.assumeEqualZoom) {
        setStep(AppStep.CROP);
    } else {
        setStep(AppStep.SCALE);
    }
  };

  const applyScaling = () => {
    if (!canvasL || !canvasR || pointsL.length < 2 || pointsR.length < 2) return;

    // Vertical distance
    const hL = Math.abs(pointsL[0].y - pointsL[1].y);
    const hR = Math.abs(pointsR[0].y - pointsR[1].y);

    if (hL === 0 || hR === 0) {
        alert("Vertical distance cannot be zero!");
        return;
    }

    let nextL = canvasL;
    let nextR = canvasR;

    const ratio = hL / hR;
    
    nextR = scaleImage(canvasR, ratio);

    setCanvasL(nextL);
    setCanvasR(nextR);
    clearPoints();
    setStep(AppStep.CROP);
  };

  const applyCropping = () => {
     if (!canvasL || !canvasR || pointsL.length < 1 || pointsR.length < 1) return;

     const { left, right } = cropImagesAligned(canvasL, canvasR, pointsL[0], pointsR[0], options.assumeEqualZoom);
     
     setCanvasL(left);
     setCanvasR(right);
     
     const merged = mergeSideBySide(left, right);
     setResultCanvas(merged);
     setStep(AppStep.RESULT);
  };

  const downloadResult = () => {
      if (!resultCanvas) return;
      const link = document.createElement('a');
      link.download = 'stereogram.jpg';
      link.href = resultCanvas.toDataURL('image/jpeg', quality / 100);
      link.click();
  };

  const resetAll = () => {
      setStep(AppStep.UPLOAD);
      setSrcL(null);
      setSrcR(null);
      setCanvasL(null);
      setCanvasR(null);
      clearPoints();
      setResultCanvas(null);
  };

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------
  
  const UploadBox = ({ side, src, onChange }: { side: 'left' | 'right', src: HTMLCanvasElement | null, onChange: (e: any) => void }) => {
      const inputId = `file-${side}`;
      return (
          <div className="flex flex-col h-full">
            <label className="text-lg font-semibold mb-2 text-gray-300 block">
                {side === 'left' ? 'Left Image' : 'Right Image'}
            </label>
            <div 
                className={`flex-1 min-h-[300px] border-4 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group
                    ${src ? 'border-green-600 bg-gray-900' : 'border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-gray-500'}`}
                onDrop={(e) => handleDrop(e, side)}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById(inputId)?.click()}
            >
                <input 
                    id={inputId}
                    type="file" 
                    accept="image/*" 
                    onChange={onChange} 
                    className="hidden" 
                />
                
                {src ? (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        <img src={src.toDataURL()} className="max-w-full max-h-full object-contain shadow-lg" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <p className="text-white font-bold flex items-center gap-2"><ImagePlus /> Change Image</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-6 text-gray-400">
                        <FileImage size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="font-medium text-lg mb-1">Click to Upload</p>
                        <p className="text-sm opacity-70">or drag and drop image here</p>
                        <p className="mt-4 text-xs bg-gray-700 px-2 py-1 rounded inline-block">No file chosen</p>
                    </div>
                )}
            </div>
          </div>
      );
  };

  const renderStepContent = () => {
    switch(step) {
        case AppStep.UPLOAD:
            return (
                <div className="flex flex-col h-full max-w-6xl mx-auto w-full gap-8">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                         <UploadBox 
                            side="left" 
                            src={srcL} 
                            onChange={(e) => handleUpload(e, 'left')} 
                         />
                         <UploadBox 
                            side="right" 
                            src={srcR} 
                            onChange={(e) => handleUpload(e, 'right')} 
                         />
                    </div>
                    
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                         <h4 className="text-lg font-semibold mb-4 text-blue-400 flex items-center gap-2"><Scaling size={20}/> Alignment Options</h4>
                         <div className="flex flex-wrap gap-6">
                             <label className="flex items-center space-x-3 cursor-pointer group">
                                <input type="checkbox" checked={options.assumeEqualTilt} onChange={e => setOptions({...options, assumeEqualTilt: e.target.checked})} className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"/>
                                <span className="group-hover:text-white text-gray-300">Assume Equal Tilt (Skip Rotation)</span>
                             </label>
                             <label className="flex items-center space-x-3 cursor-pointer group">
                                <input type="checkbox" checked={options.assumeEqualZoom} onChange={e => setOptions({...options, assumeEqualZoom: e.target.checked})} className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"/>
                                <span className="group-hover:text-white text-gray-300">Assume Equal Zoom (Skip Scaling)</span>
                             </label>
                             <label className="flex items-center space-x-3 cursor-pointer group">
                                <input type="checkbox" checked={options.assumeEqualFraming} onChange={e => setOptions({...options, assumeEqualFraming: e.target.checked})} className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-gray-800"/>
                                <span className="group-hover:text-yellow-300 text-yellow-400 font-medium">Assume Equal Framing (Merge Directly)</span>
                             </label>
                         </div>
                    </div>

                    <div className="flex justify-center pb-8">
                         <button 
                            disabled={!srcL || !srcR}
                            onClick={startProcessing}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white text-lg shadow-lg shadow-blue-900/20 flex items-center gap-3 transition-all transform hover:scale-105"
                         >
                            Start Alignment <ArrowRight size={24} />
                         </button>
                    </div>
                </div>
            );
        
        case AppStep.ROTATE:
            return (
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-4">
                         <div className="text-sm">
                            <h3 className="font-bold text-xl text-blue-400 flex items-center gap-2"><RotateCw /> Rotation Alignment</h3>
                            <p className="text-gray-400">Click 2 points on a horizontal feature in BOTH images.</p>
                         </div>
                         <div className="flex gap-4 items-center">
                            <label className="flex items-center gap-2 text-sm bg-gray-800 px-3 py-1 rounded">
                                <span>Rotate:</span>
                                <select 
                                    className="bg-gray-700 border-none rounded p-1 text-white"
                                    value={options.rotateLeftImage ? 'left' : 'right'}
                                    onChange={(e) => setOptions({...options, rotateLeftImage: e.target.value === 'left'})}
                                >
                                    <option value="right">Right Image</option>
                                    <option value="left">Left Image</option>
                                </select>
                            </label>
                            <button 
                                onClick={undoLastPoint} 
                                disabled={pointHistory.length === 0}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1 text-sm"
                            >
                                <Undo2 size={16}/> Undo
                            </button>
                            <button 
                                disabled={pointsL.length < 2 || pointsR.length < 2}
                                onClick={applyRotation}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded font-bold text-white shadow-lg"
                            >
                                Apply Rotation
                            </button>
                         </div>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                         <InteractiveCanvas 
                             image={canvasL} 
                             points={pointsL} 
                             maxPoints={2} 
                             onAddPoint={(p) => handleAddPoint('left', p)} 
                             label="Left Image"
                             active={true}
                         />
                         <InteractiveCanvas 
                             image={canvasR} 
                             points={pointsR} 
                             maxPoints={2} 
                             onAddPoint={(p) => handleAddPoint('right', p)} 
                             label="Right Image"
                             active={true}
                         />
                    </div>
                </div>
            );

        case AppStep.SCALE:
            return (
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-4">
                         <div className="text-sm">
                            <h3 className="font-bold text-xl text-blue-400 flex items-center gap-2"><Scaling /> Scale Alignment</h3>
                            <p className="text-gray-400">Click 2 points to define vertical height in BOTH images.</p>
                         </div>
                         <div className="flex gap-4 items-center">
                            <button 
                                onClick={undoLastPoint} 
                                disabled={pointHistory.length === 0}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1 text-sm"
                            >
                                <Undo2 size={16}/> Undo
                            </button>
                            <button 
                                disabled={pointsL.length < 2 || pointsR.length < 2}
                                onClick={applyScaling}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded font-bold text-white shadow-lg"
                            >
                                Apply Scaling
                            </button>
                         </div>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                         <InteractiveCanvas 
                             image={canvasL} 
                             points={pointsL} 
                             maxPoints={2} 
                             onAddPoint={(p) => handleAddPoint('left', p)} 
                             label="Left Image"
                             active={true}
                             color="orange"
                         />
                         <InteractiveCanvas 
                             image={canvasR} 
                             points={pointsR} 
                             maxPoints={2} 
                             onAddPoint={(p) => handleAddPoint('right', p)} 
                             label="Right Image"
                             active={true}
                             color="orange"
                         />
                    </div>
                </div>
            );

        case AppStep.CROP:
            return (
                <div className="h-full flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-4">
                         <div className="text-sm">
                            <h3 className="font-bold text-xl text-blue-400 flex items-center gap-2"><Crop /> Crop Alignment</h3>
                            <p className="text-gray-400">Click the SAME center feature point in BOTH images.</p>
                         </div>
                         <div className="flex gap-4 items-center">
                            <button 
                                onClick={undoLastPoint} 
                                disabled={pointHistory.length === 0}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1 text-sm"
                            >
                                <Undo2 size={16}/> Undo
                            </button>
                            <button 
                                disabled={pointsL.length < 1 || pointsR.length < 1}
                                onClick={applyCropping}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded font-bold text-white shadow-lg"
                            >
                                Apply Crop & Merge
                            </button>
                         </div>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                         <InteractiveCanvas 
                             image={canvasL} 
                             points={pointsL} 
                             maxPoints={1} 
                             onAddPoint={(p) => handleAddPoint('left', p)} 
                             label="Left Image"
                             active={true}
                             color="#3b82f6"
                         />
                         <InteractiveCanvas 
                             image={canvasR} 
                             points={pointsR} 
                             maxPoints={1} 
                             onAddPoint={(p) => handleAddPoint('right', p)} 
                             label="Right Image"
                             active={true}
                             color="#3b82f6"
                         />
                    </div>
                </div>
            );

        case AppStep.RESULT:
            return (
                <div className="h-full flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-4 px-4">
                        <h3 className="font-bold text-xl text-green-400 flex items-center gap-2"><CheckCircle /> Result</h3>
                        <div className="flex gap-4 items-center bg-gray-800 p-2 rounded-lg">
                             <span className="text-sm text-gray-300">Quality: {quality}%</span>
                             <input type="range" min="10" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))} className="w-32" />
                             <button onClick={downloadResult} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-white flex items-center gap-2">
                                <Download size={18} /> Download JPG
                             </button>
                        </div>
                    </div>
                    <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4 bg-gray-900 border border-gray-700 rounded-lg">
                        {resultCanvas ? (
                             <img src={resultCanvas.toDataURL('image/jpeg', quality/100)} className="max-w-full max-h-full shadow-2xl" />
                        ) : (
                            <p>Processing error.</p>
                        )}
                    </div>
                    <div className="mt-4">
                        <button onClick={resetAll} className="px-4 py-2 text-gray-400 hover:text-white flex items-center gap-2">
                            <RotateCcw size={16}/> Start Over
                        </button>
                    </div>
                </div>
            );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-200 font-sans">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 p-4">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Scaling className="text-white" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">StereoAlign</h1>
                </div>
                <div className="flex gap-2">
                   {step !== AppStep.UPLOAD && (
                       <button onClick={resetAll} className="text-sm text-red-400 hover:text-red-300 px-3 py-1 border border-red-900/50 bg-red-900/20 rounded">
                          Reset
                       </button>
                   )}
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto p-4 flex flex-col min-h-0">
            {renderStepContent()}
        </main>
    </div>
  );
};

export default App;