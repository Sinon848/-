import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Film,
  Image as ImageIcon,
  Settings,
  Upload,
  Loader2,
  FileArchive,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  extractVideoFrames,
  downloadFramesAsZip,
  exportFramesToPdf,
  ExtractionSettings,
  ExtractedFrame
} from './lib/extractor';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<ExtractionSettings>({
    frameCount: 10,
    format: 'jpeg',
    quality: 0.9,
  });

  const [status, setStatus] = useState<'idle' | 'extracting' | 'zipping' | 'exporting_pdf' | 'error' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<ExtractedFrame | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Cleanup generated blob URLs on unmount or when frames state changes
    return () => {
      frames.forEach(frame => URL.revokeObjectURL(frame.url));
    };
  }, [frames]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      setVideoUrl(URL.createObjectURL(selectedFile));
      setFrames([]);
      setSelectedFrame(null);
      setStatus('idle');
      setProgress(0);
    } else if (selectedFile) {
      alert("Please upload a valid video file.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
      setVideoUrl(URL.createObjectURL(droppedFile));
      setFrames([]);
      setSelectedFrame(null);
      setStatus('idle');
      setProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const clearFile = () => {
    setFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setFrames([]);
    setSelectedFrame(null);
    setStatus('idle');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startExtraction = async () => {
    if (!file) return;
    setStatus('extracting');
    setProgress(0);
    setErrorMsg('');
    try {
      const extracted = await extractVideoFrames(file, settings, (p) => setProgress(p));
      setFrames(extracted);
      if (extracted.length > 0) {
        setSelectedFrame(extracted[0]);
      }
      setStatus('done');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || "Failed to extract frames.");
    }
  };

  const downloadAll = async () => {
    if (frames.length === 0) return;
    setStatus('zipping');
    setProgress(0);
    try {
      await downloadFramesAsZip(frames, settings.format, (p) => setProgress(p));
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setErrorMsg("Failed to zip and download files.");
    }
  };

  const exportPdf = async () => {
    if (frames.length === 0) return;
    setStatus('exporting_pdf');
    setProgress(0);
    try {
      await exportFramesToPdf(frames, (p) => setProgress(p));
      setStatus('done');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMsg("Failed to export PDF.");
    }
  };

  const downloadSingleFrame = (frame: ExtractedFrame) => {
    const a = document.createElement('a');
    a.href = frame.url;
    a.download = `frame_${frame.index.toString().padStart(4, '0')}.${settings.format === 'jpeg' ? 'jpg' : settings.format}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-semibold tracking-tight">Video Frame Extractor</span>
          </div>
          {frames.length > 0 && status !== 'extracting' && status !== 'zipping' && status !== 'exporting_pdf' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportPdf}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-black transition-colors text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm"
              >
                <FileArchive className="w-4 h-4" />
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
              <button
                type="button"
                onClick={downloadAll}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm"
              >
                <FileArchive className="w-4 h-4" />
                <span className="hidden sm:inline">Download All (ZIP)</span>
                <span className="sm:hidden">ZIP</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-12">
        
        {/* Left Column: Upload & Settings */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Upload Section */}
          <div className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Media Source
            </h2>
            
            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-neutral-50 hover:border-blue-400 transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-medium text-neutral-800">Click or drag video here</p>
                <p className="text-sm text-neutral-500 mt-1">MP4, WebM, OGG, MOV</p>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="relative group rounded-lg overflow-hidden border border-neutral-200 bg-black aspect-video flex items-center justify-center">
                <video src={videoUrl!} className="max-w-full max-h-full" controls={false} muted />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <button
                    type="button"
                    onClick={clearFile}
                    className="bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-full transform hover:scale-105 transition-all shadow-lg"
                    title="Remove video"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 max-w-[80%] truncate bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                  {file.name}
                </div>
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Extraction Settings
            </h2>
            
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-medium text-neutral-700">Number of Frames</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={settings.frameCount}
                      onChange={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val)) val = 1;
                        setSettings({ ...settings, frameCount: Math.min(1000, Math.max(1, val)) });
                      }}
                      className="w-16 px-1.5 py-0.5 text-right text-sm font-semibold text-blue-600 border border-neutral-200 rounded focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="1000"
                  value={settings.frameCount}
                  onChange={(e) => setSettings({ ...settings, frameCount: parseInt(e.target.value) })}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  disabled={status === 'extracting' || status === 'zipping'}
                />
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>1</span>
                  <span>Extract evenly</span>
                  <span>1000</span>
                </div>
                {settings.frameCount > 300 && (
                  <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> 
                    High frame counts may increase memory usage.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700 block mb-1.5">Image Format</label>
                <div className="flex gap-2">
                  {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
                    <button
                      type="button"
                      key={fmt}
                      onClick={() => setSettings({ ...settings, format: fmt })}
                      disabled={status === 'extracting' || status === 'zipping' || status === 'exporting_pdf'}
                      className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium uppercase tracking-wider transition-colors border ${
                        settings.format === fmt
                          ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                          : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {settings.format !== 'png' && (
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm font-medium text-neutral-700">Image Quality</label>
                    <span className="text-sm text-neutral-500">{Math.round(settings.quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.quality * 100}
                    onChange={(e) => setSettings({ ...settings, quality: parseInt(e.target.value) / 100 })}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    disabled={status === 'extracting' || status === 'zipping'}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={startExtraction}
                disabled={!file || status === 'extracting' || status === 'zipping' || status === 'exporting_pdf'}
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-black disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm transition-colors flex justify-center items-center gap-2 mt-4"
              >
                {status === 'extracting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Extracting...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" /> Extract {settings.frameCount} Frames
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8">
          <div className="bg-white p-5 border border-neutral-200 rounded-xl shadow-sm min-h-[400px] flex flex-col">
            <h2 className="text-base font-semibold mb-4 flex items-center justify-between pb-4 border-b border-neutral-100">
              <span className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-neutral-500" /> Extracted Frames
              </span>
              {frames.length > 0 && <span className="text-sm bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">{frames.length} items</span>}
            </h2>

            {status === 'idle' && frames.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-3 min-h-[300px]">
                <ImageIcon className="w-12 h-12 stroke-1 opacity-50" />
                <p>Upload a video and start extraction to see frames here.</p>
              </div>
            )}

            {(status === 'extracting' || status === 'zipping' || status === 'exporting_pdf') && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-6 min-h-[300px]">
                <div className="w-16 h-16 relative flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-neutral-100 rounded-full animate-ping opacity-20"></div>
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin absolute" />
                </div>
                <div className="text-center w-full max-w-xs">
                  <p className="font-medium text-neutral-800 mb-2">
                    {status === 'extracting' ? 'Extracting frames...' : status === 'zipping' ? 'Creating zip archive...' : 'Generating PDF...'}
                  </p>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">{Math.round(progress)}% Complete</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-red-500 text-center gap-3 min-h-[300px]">
                <AlertCircle className="w-10 h-10" />
                <div>
                  <p className="font-semibold text-red-700">Oops, something went wrong</p>
                  <p className="text-sm mt-1">{errorMsg}</p>
                </div>
              </div>
            )}

            {frames.length > 0 && status !== 'extracting' && status !== 'zipping' && (
              <div className="space-y-6">
                {/* Large Preview Section */}
                {selectedFrame && (
                  <div className="bg-neutral-50 rounded-xl overflow-hidden border border-neutral-200 shadow-inner">
                    <div className="md:flex">
                      <div className="md:w-2/3 bg-black flex items-center justify-center aspect-video">
                        <img 
                          src={selectedFrame.url} 
                          alt={`Selected Frame ${selectedFrame.index}`} 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="md:w-1/3 p-6 flex flex-col justify-center gap-4">
                        <div>
                          <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-1">Selected Frame</h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-neutral-900">#{selectedFrame.index}</span>
                            <span className="text-neutral-500 text-sm">{formatTime(selectedFrame.time)}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => downloadSingleFrame(selectedFrame)}
                            className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                          >
                            <Download className="w-4 h-4" /> Download Image
                          </button>
                        </div>
                        
                        <div className="text-[10px] text-neutral-400 bg-neutral-100 p-2 rounded">
                          <p>Format: {settings.format.toUpperCase()}</p>
                          <p>Timestamp: {selectedFrame.time.toFixed(4)}s</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grid Section */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {frames.map((frame) => (
                    <div 
                      key={frame.id} 
                      onClick={() => setSelectedFrame(frame)}
                      className={`group relative rounded-lg overflow-hidden border transition-all cursor-pointer aspect-video flex-shrink-0 ${
                        selectedFrame?.id === frame.id 
                          ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-2' 
                          : 'border-neutral-200 hover:border-blue-400'
                      }`}
                    >
                      <img 
                        src={frame.url} 
                        alt={`Frame ${frame.index}`} 
                        className="w-full h-full object-cover lg:object-contain bg-neutral-100"
                      />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 backdrop-blur-[1px]">
                        <div className="bg-white text-neutral-900 rounded-full p-2 shadow-lg">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Metadata Labels */}
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono shadow-sm">
                        {formatTime(frame.time)}
                      </div>
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono shadow-sm">
                        #{frame.index}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

