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
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-center gap-3">
        <XCircle className="w-5 h-5 shrink-0" />
        <div>
          <span className="font-bold block">Validation Error</span>
          <span>{error || 'Invalid or corrupted ZIP file.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3 text-xs">
      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
        <CheckCircle2 className="w-5 h-5" />
        <span>Validation Summary</span>
      </div>

      <div className="space-y-2 font-mono">
        {sourceType === 'upload' ? (
          <>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ZIP file is valid {fileInfo?.filename ? `(${fileInfo.filename})` : ''}</span>
            </div>
            {isAdded && (
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Module added successfully</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>GitHub URL valid</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Repository found ({repoInfo?.owner}/{repoInfo?.name})</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Repository downloaded</span>
            </div>
            {isAdded && (
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Module added successfully</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
