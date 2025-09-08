import React, { useRef } from 'react';
import { sampleLogs, SampleLogKey } from '../constants';
import { UploadCloudIcon } from './Icons';

interface LogInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  loadSample: (key: SampleLogKey) => void;
}

export const LogInput: React.FC<LogInputProps> = ({ value, onChange, loadSample }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Create a synthetic event to pass to the parent onChange handler
        const syntheticEvent = {
          target: { value: text }
        } as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(syntheticEvent);
      };
      reader.readAsText(file);
    }
     // Reset file input to allow uploading the same file again
    if(event.target) {
        event.target.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-1 border border-gray-700 shadow-lg">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <span className="text-sm font-medium text-gray-400 mr-2">Use Sample:</span>
        {(Object.keys(sampleLogs) as SampleLogKey[]).map(key => (
          <button
            key={key}
            onClick={() => loadSample(key)}
            className="px-3 py-1 text-xs font-medium bg-gray-700 hover:bg-purple-600 rounded-full transition-colors"
          >
            {key}
          </button>
        ))}
        <div className="flex-grow"></div>
         <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.txt,.json,.log"
        />
        <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 px-3 py-1 text-xs font-medium bg-gray-700 hover:bg-purple-600 rounded-full transition-colors"
        >
            <UploadCloudIcon className="w-4 h-4" />
            Upload File
        </button>
      </div>
      <textarea
        value={value}
        onChange={onChange}
        placeholder="Or paste vendor logs here (CSV, TSV, PDF table text, or JSON)..."
        className="w-full h-60 bg-gray-900 text-gray-300 p-4 rounded-b-md border-t border-gray-700 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-y font-mono text-sm"
        aria-label="Vendor Logs Input"
      />
    </div>
  );
};
