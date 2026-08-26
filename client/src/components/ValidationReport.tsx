import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ValidationResult } from '../types';

interface ValidationReportProps {
  report: ValidationResult;
  sourceType?: 'upload' | 'github';
  isAdded?: boolean;
}

export const ValidationReport: React.FC<ValidationReportProps> = ({
  report,
  sourceType = 'upload',
  isAdded = false,
}) => {
  const { valid, error, repoInfo, fileInfo } = report;

  if (!valid) {
    return (
      <div className="p-4 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-3">
        <XCircle className="w-5 h-5 shrink-0" />
        <div>
          <span className="font-bold block">Validation Error</span>
          <span>{error || 'Invalid or corrupted ZIP file.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#2E7D5B]/30 space-y-3 text-xs shadow-card">
      <div className="flex items-center gap-2 text-[#2E7D5B] font-bold text-sm">
        <CheckCircle2 className="w-5 h-5" />
        <span>Validation Summary</span>
      </div>

      <div className="space-y-2 font-mono">
        {sourceType === 'upload' ? (
          <>
            <div className="flex items-center gap-2 text-[#202524]">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span>ZIP file is valid {fileInfo?.filename ? `(${fileInfo.filename})` : ''}</span>
            </div>
            {isAdded && (
              <div className="flex items-center gap-2 text-[#202524]">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
                <span>Module added successfully</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[#202524]">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span>GitHub URL valid</span>
            </div>
            <div className="flex items-center gap-2 text-[#202524]">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span>Repository found ({repoInfo?.owner}/{repoInfo?.name})</span>
            </div>
            <div className="flex items-center gap-2 text-[#202524]">
              <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span>Repository downloaded</span>
            </div>
            {isAdded && (
              <div className="flex items-center gap-2 text-[#202524]">
                <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
                <span>Module added successfully</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
