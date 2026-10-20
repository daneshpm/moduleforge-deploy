import React, { useEffect, useState } from 'react';
import { ArrowUpCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { useProjectRepoStore, ModuleUpdateInfo, UpgradePlan } from '../../store/useProjectRepoStore';

interface Props {
  projectId: string;
  update: ModuleUpdateInfo;
  onClose: () => void;
}

/** Shows the dry-run plan (files, conflicts, dependency blocks) and only then lets the user confirm the upgrade. */
export const ModuleUpgradeDialog: React.FC<Props> = ({ projectId, update, onClose }) => {
  const { previewUpgrade, applyUpgrade, isIngesting } = useProjectRepoStore();
  const [plan, setPlan] = useState<UpgradePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default target: latest version within the pinned range (breaking majors need an explicit later choice).
  const target = update.latestSatisfyingPinnedRange && update.latestSatisfyingPinnedRange !== update.installed
    ? update.latestSatisfyingPinnedRange
    : update.latest || undefined;
  const [toVersion, setToVersion] = useState<string | undefined>(target);

  useEffect(() => {
    let cancelled = false;
    setPlan(null);
    previewUpgrade(projectId, update.projectModuleId, toVersion).then((p) => !cancelled && setPlan(p));
    return () => {
      cancelled = true;
    };
  }, [projectId, update.projectModuleId, toVersion, previewUpgrade]);

  const hasConflicts = !!plan?.conflicts?.length;
  const depBlocked = !!plan?.missing?.length || (!!plan?.blocked && !!plan?.details?.length);
  const canApply = !!plan && !plan.upToDate && !depBlocked;

  const confirm = async () => {
    setError(null);
    const res = await applyUpgrade(projectId, update.projectModuleId, { toVersion, force: hasConflicts });
    if (res.success) onClose();
    else setError(res.error || 'Upgrade failed');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl border border-[#E2E6E4] shadow-card w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-[#1F5E4B]" />
            Upgrade {update.name}: v{update.installed} to v{toVersion}
          </h3>
          <button onClick={onClose} className="text-[#6B7471] hover:text-[#202524]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {update.latest && update.latest !== toVersion && (
          <button
            onClick={() => setToVersion(update.latest!)}
            className="text-[11px] text-[#1F5E4B] underline"
          >
            Choose latest v{update.latest}
            {update.breaking ? ' (breaking)' : ''} instead
          </button>
        )}

        {!plan && (
          <div className="flex items-center gap-2 text-xs text-[#6B7471]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking what would change...
          </div>
        )}

        {plan?.breaking && (
          <div className="p-3 rounded-2xl bg-[#FDF3E7] border border-[#E9C58F] text-[11px] text-[#7A4B0E] flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Major version bump: this release may contain breaking changes.
          </div>
        )}

        {plan?.changelog && <p className="text-[11px] text-[#6B7471] whitespace-pre-line">{plan.changelog}</p>}

        {depBlocked && (
          <div className="p-3 rounded-2xl bg-[#FBEDED] border border-[#E4B1B1] text-[11px] text-[#8A2323] space-y-1">
            <div className="font-bold">Blocked by dependencies</div>
            {(plan?.details || []).map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
        )}

        {plan?.files && (
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono">
            {(['added', 'changed', 'removed', 'preserved'] as const).map((k) => (
              <div key={k} className="p-2 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
                <div className="font-bold text-[#202524]">{plan.files![k].length}</div>
                <div className="text-[#6B7471]">{k}</div>
              </div>
            ))}
          </div>
        )}

        {hasConflicts && !depBlocked && (
          <div className="p-3 rounded-2xl bg-[#FDF3E7] border border-[#E9C58F] text-[11px] text-[#7A4B0E] space-y-1">
            <div className="font-bold">Local changes would be overwritten</div>
            <div className="max-h-28 overflow-auto font-mono">
              {plan!.conflicts!.map((c) => (
                <div key={c.path}>
                  {c.path} <span className="opacity-70">({c.kind})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {plan?.upToDate && <p className="text-xs text-[#6B7471]">Already up to date.</p>}
        {error && <p className="text-xs text-[#8A2323]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded-xl text-xs border border-[#E2E6E4] text-[#202524]">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!canApply || isIngesting}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1F5E4B] text-white disabled:opacity-40"
          >
            {isIngesting ? 'Upgrading...' : hasConflicts ? 'Overwrite and upgrade' : 'Upgrade'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleUpgradeDialog;
