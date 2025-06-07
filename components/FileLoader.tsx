import React, { useRef, useState } from 'react';

interface FileLoaderProps {
  label: string;
  onFileLoad: (fileName: string, content: string) => void;
  isLoading: boolean;
  loadedFileName: string | null;
  idPrefix: string;
  icon?: React.ReactNode;
}

export const FileLoader: React.FC<FileLoaderProps> = ({ 
  label, 
  onFileLoad, 
  isLoading, 
  loadedFileName, 
  idPrefix, 
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

  const getStatusIcon = () => {
    if (isLoading) {
      return <div className="loading-spinner" />;
    }
    if (loadedFileName) {
      return (
        <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    );
  };

  const getStatusClass = () => {
    if (loadedFileName) return 'file-loader loaded';
    if (isDragOver) return 'file-loader drag-over';
    return 'file-loader';
  };

  return (
    <div
      className={`card ${getStatusClass()} text-center`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="flex justify-center">
          {getStatusIcon()}
        </div>
        
        <div>
          <h3 className="card-title text-lg">{label} JSON</h3>
          {isLoading ? (
            <p className="card-description">Loading file...</p>
          ) : loadedFileName ? (
            <div className="space-y-1">
              <p className="text-success font-medium">✓ File loaded successfully</p>
              <p className="text-muted text-sm truncate max-w-xs" title={loadedFileName}>
                {loadedFileName}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="card-description">
                {isDragOver ? 'Drop file here...' : 'Click or drag file to upload'}
              </p>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                Select File
              </button>
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
