'use client';

/**
 * organ-map.tsx — the living schematic of the organism, Neon OS style.
 * brain (Hermes) ⇄ spine (ACP/v1) ⇄ nerves (OpenClaw gateway) → hands (MCP
 * bridges) + legs (channels). Every node glows with live status.
 */

interface OrganMapProps {
  brainStatus: 'online' | 'standby' | 'offline' | 'engine-off';
  limbsStatus: 'online' | 'standby' | 'offline' | 'engine-off';
  spineOk: boolean | null; // null = never probed
  gatewayRunning: boolean;
  brainVersion?: string;
  limbsVersion?: string;
}

const COLOR: Record<string, string> = {
  online: 'hsl(182 100% 50%)',      // neon cyan — alive
  standby: 'hsl(45 100% 55%)',      // amber — present, not running
  offline: 'hsl(350 100% 67%)',     // red — missing
  'engine-off': 'hsl(220 10% 45%)', // grey — no engine
};

const Label = ({ x, y, children, sub }: { x: number; y: number; children: React.ReactNode; sub?: string }) => (
  <g>
    <text x={x} y={y} textAnchor="middle" fill="hsl(182 100% 50%)" fontSize="13" fontWeight={700} letterSpacing="2">
      {children}
    </text>
    {sub && (
      <text x={x} y={y + 15} textAnchor="middle" fill="hsl(210 20% 55%)" fontSize="10" letterSpacing="1">
        {sub}
      </text>
    )}
  </g>
);

const Node = ({ cx, cy, r, status, title }: { cx: number; cy: number; r: number; status: string; title: string }) => (
  <g>
    <circle cx={cx} cy={cy} r={r + 14} fill="none" stroke={COLOR[status]} strokeOpacity={0.25} strokeWidth={1}>
      <animate attributeName="r" values={`${r + 10};${r + 18};${r + 10}`} dur="4s" repeatCount="indefinite" />
    </circle>
    <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke={COLOR[status]} strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 3">
      <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="18s" repeatCount="indefinite" />
    </circle>
    <circle cx={cx} cy={cy} r={r} fill={COLOR[status]} fillOpacity={0.15} stroke={COLOR[status]} strokeWidth={2}>
      {status === 'online' && <animate attributeName="fillOpacity" values="0.12;0.3;0.12" dur="2s" repeatCount="indefinite" />}
    </circle>
    <text x={cx} y={cy + 4} textAnchor="middle" fill={COLOR[status]} fontSize="11" fontWeight={900} letterSpacing="1.5">
      {title}
    </text>
  </g>
);

export default function OrganMap({ brainStatus, limbsStatus, spineOk, gatewayRunning, brainVersion, limbsVersion }: OrganMapProps) {
  const spine = spineOk === null ? COLOR.standby : spineOk ? COLOR.online : COLOR.offline;
  const nerve = gatewayRunning ? COLOR.online : COLOR.offline;
  return (
    <svg viewBox="0 0 800 380" className="w-full font-headline select-none" role="img" aria-label="DeanGo organism map">
      {/* spine — the ACP/v1 contract: brain ↔ nerves */}
      <line x1={400} y1={118} x2={400} y2={192} stroke={spine} strokeWidth={2.5} strokeOpacity={spineOk ? 1 : 0.7}>
        {spineOk && <animate attributeName="strokeOpacity" values="0.5;1;0.5" dur="1.6s" repeatCount="indefinite" />}
      </line>
      <text x={418} y={150} fill={spine} fontSize="10" letterSpacing="1.5">
        SPINE · ACP/v1{spineOk === false ? ' · BROKEN' : spineOk ? ' · LIVE' : ' · UNPROBED'}
      </text>
      {spineOk && (
        <circle r="4" fill={COLOR.online}>
          <animateMotion dur="2.2s" repeatCount="indefinite" path="M 400 118 L 400 192" />
        </circle>
      )}

      {/* nerves → hands/legs */}
      <path d="M 400 232 C 330 260, 240 270, 180 288" fill="none" stroke={nerve} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 4" />
      <path d="M 400 232 C 470 260, 560 270, 620 288" fill="none" stroke={nerve} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="6 4" />

      {/* BRAIN */}
      <Node cx={400} cy={90} r={30} status={brainStatus} title="BRAIN" />
      <Label x={400} y={42} sub={`HERMES ${brainVersion || '—'} · turn loop · memory · 212 skills · persona`}>
        HERMES
      </Label>

      {/* NERVES */}
      <Node cx={400} cy={212} r={26} status={gatewayRunning ? 'online' : limbsStatus === 'engine-off' ? 'engine-off' : 'offline'} title="NERVES" />
      <Label x={400} y={172}>OPENCLAW GATEWAY</Label>

      {/* HANDS */}
      <Node cx={180} cy={300} r={22} status={limbsStatus} title="HANDS" />
      <Label x={180} y={340} sub="acpx MCP bridges · plugin tools">
        MCP BRIDGES
      </Label>

      {/* LEGS */}
      <Node cx={620} cy={300} r={22} status={limbsStatus} title="LEGS" />
      <Label x={620} y={340} sub="whatsapp · telegram · slack · discord · voice · sms …">
        CHANNELS
      </Label>

      {/* LIMBS label */}
      <Label x={602} y={80} sub={`OPENCLAW ${limbsVersion || '—'} · approvals · artifacts · ledger`}>
        LIMBS
      </Label>
    </svg>
  );
}
