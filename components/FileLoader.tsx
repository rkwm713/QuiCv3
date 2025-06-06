import React, { useRef, useState } from 'react';

interface FileLoaderProps {
  label: string;
  onFileLoad: (fileName: string, content: string) => void;
  isLoading: boolean;
  loadedFileName: string | null;
  idPrefix: string;
  icon: React.ReactNode;
}

export const FileLoader: React.FC<FileLoaderProps> = ({ 
  label, 
  onFileLoad, 
  isLoading, 
  loadedFileName, 
  idPrefix, 
  icon 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileLoad(file.name, content);
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getStatusColor = () => {
    if (isLoading) return 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-transparent shadow-lg shadow-yellow-500/25';
    if (loadedFileName) return 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-transparent shadow-lg shadow-emerald-500/25';
    return 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600 hover:border-slate-500';
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return (
        <div className="animate-spin">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      );
    }
    if (loadedFileName) {
      return (
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    return icon;
  };

  return (
    <div className="w-full">
      <div
        className={`
          relative overflow-hidden rounded-lg border font-medium
          transition-all duration-300 transform cursor-pointer
          hover:scale-105 hover:shadow-xl
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:ring-offset-2 focus:ring-offset-slate-800
          ${isDragOver ? 'scale-105 shadow-xl ring-2 ring-emerald-400/50' : ''}
          ${getStatusColor()}
          ${isLoading ? 'animate-pulse' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full hover:animate-shimmer" />
        
        <div className="relative p-6 text-center space-y-3">
          {/* Icon and Status */}
          <div className="flex justify-center">
            <div className={`
              transition-transform duration-300
              ${!isLoading && !loadedFileName ? 'hover:scale-110' : ''}
            `}>
              {getStatusIcon()}
            </div>
          </div>

          {/* Title */}
          <h3 className="font-semibold">
            {label} JSON
          </h3>

          {/* Status Text */}
          <div className="space-y-1">
            {isLoading ? (
              <div className="text-sm animate-pulse">
                Loading file...
              </div>
            ) : loadedFileName ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  ✓ Loaded successfully
                </div>
                <div className="text-xs opacity-80 truncate max-w-32" title={loadedFileName}>
                  {loadedFileName}
                </div>
              </div>
            ) : (
              <div className="text-sm opacity-90">
                {isDragOver ? 'Drop file here...' : 'Click or drag file to upload'}
              </div>
            )}
          </div>

          {/* Progress bar for loading state */}
          {isLoading && (
            <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-white rounded-full animate-pulse"></div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileInputChange}
        className="hidden"
        id={`${idPrefix}-file-input`}
      />
    </div>
  );
};
