import React from 'react';
import { ShieldCheck, AlertTriangle, KeyRound, Link2, Zap, Lock } from 'lucide-react';

export interface ContractInfo {
  contractVersion?: string | null;
  dependsOn?: any;
  requiredEnv?: any;
  permissions?: any;
  eventsPublished?: any;
  eventsConsumed?: any;
  hostServices?: any;
}

// Columns arrive as JSON strings from the DB and as objects from a validated manifest
function toList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Build ContractInfo from a validated manifest (used on the publish page). */
export function contractInfoFromManifest(m: any): ContractInfo | null {
  if (!m) return null;
  return {
    contractVersion: '1',
    dependsOn: m.dependsOn || [],
    requiredEnv: m.requires?.env || [],
    hostServices: m.requires?.hostServices || [],
    permissions: m.permissions || [],
    eventsPublished: m.events?.publishes || [],
    eventsConsumed: m.events?.consumes || [],
  };
}

export const LegacyBadge: React.FC = () => (
  <span
    title="No module.json contract: dependencies, env vars and permissions are unknown"
    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF8EC] text-[#B7791F] border border-[#B7791F]/20"
  >
    <AlertTriangle className="w-3 h-3" />
    legacy module
  </span>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2.5 py-1 rounded-lg bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] font-mono text-xs">{children}</span>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; empty: string; children?: React.ReactNode; count: number }> = ({
  icon,
  title,
  empty,
  children,
  count,
}) => (
  <div className="space-y-1.5">
    <span className="text-[11px] font-mono text-[#6B7471] flex items-center gap-1.5 uppercase">
      {icon}
      {title}
    </span>
    {count > 0 ? <div className="flex flex-wrap gap-1.5">{children}</div> : <span className="text-xs text-[#6B7471] italic">{empty}</span>}
  </div>
);

export const ContractPanel: React.FC<{ contract: ContractInfo | null }> = ({ contract }) => {
  if (!contract || !contract.contractVersion) {
    return (
      <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-2 shadow-card">
        <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1F5E4B]" />
          <span>Module Contract</span>
          <LegacyBadge />
        </h3>
        <p className="text-xs text-[#6B7471]">
          This module has no <code className="font-mono">module.json</code>, so its dependencies, required env vars, permissions and events are not machine-checkable.
        </p>
      </div>
    );
  }

  const deps = toList(contract.dependsOn);
  const env = toList(contract.requiredEnv);
  const perms = toList(contract.permissions);
  const pub = toList(contract.eventsPublished);
  const con = toList(contract.eventsConsumed);
  const host = toList(contract.hostServices);

  return (
    <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-4 shadow-card">
      <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#1F5E4B]" />
        <span>Module Contract</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold">
          manifest v{contract.contractVersion}
        </span>
      </h3>
      <Section icon={<Link2 className="w-3 h-3" />} title="Depends on" empty="No dependencies" count={deps.length}>
        {deps.map((d: any, i: number) => (
          <Chip key={i}>
            {d.id} {d.versionRange}
          </Chip>
        ))}
      </Section>
      <Section icon={<KeyRound className="w-3 h-3" />} title="Required env vars" empty="None" count={env.length}>
        {env.map((e: any, i: number) => (
          <span key={i} title={e.description || ''}>
            <Chip>
              {e.name}
              {e.secret ? ' (secret)' : ''}
            </Chip>
          </span>
        ))}
      </Section>
      <Section icon={<Lock className="w-3 h-3" />} title="Permissions" empty="None" count={perms.length}>
        {perms.map((p: string) => (
          <Chip key={p}>{p}</Chip>
        ))}
      </Section>
      <Section icon={<Zap className="w-3 h-3" />} title="Events published" empty="None" count={pub.length}>
        {pub.map((p: string) => (
          <Chip key={p}>{p}</Chip>
        ))}
      </Section>
      <Section icon={<Zap className="w-3 h-3" />} title="Events consumed" empty="None" count={con.length}>
        {con.map((p: string) => (
          <Chip key={p}>{p}</Chip>
        ))}
      </Section>
      <Section icon={<Link2 className="w-3 h-3" />} title="Host services" empty="None" count={host.length}>
        {host.map((p: string) => (
          <Chip key={p}>{p}</Chip>
        ))}
      </Section>
    </div>
  );
};
