import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, FlaskConical, GitMerge, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Static, illustrative product screenshots rendered as live UI (no image assets needed). */

export function BrowserFrame({ children, className, url = "app.harvestquoin.com" }: { children: ReactNode; className?: string; url?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-forest-900/10 bg-card shadow-2xl shadow-forest-900/15", className)}>
      <div className="flex items-center gap-2 border-b bg-earth-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 truncate rounded-md bg-card px-2 py-0.5 text-[10px] text-muted-foreground">{url}</span>
      </div>
      {children}
    </div>
  );
}

const MINI_KPIS = [
  { l: "Active batches", v: "16", i: Package },
  { l: "Priority dispatch", v: "4", i: AlertTriangle, warn: true },
  { l: "Orders awaiting", v: "6", i: GitMerge },
  { l: "Dispatching today", v: "3", i: Truck },
];

const QUEUE = [
  { c: "TOM-261112-009", v: "UC82B · 1.4 t", s: 83, lvl: "Dispatch now", tone: "bg-red-100 text-red-700", g: "C" },
  { c: "TOM-261115-007", v: "Tropimech · 8.8 t", s: 64, lvl: "Dispatch now", tone: "bg-red-100 text-red-700", g: "A" },
  { c: "TOM-261113-013", v: "Roma VF · 5.0 t", s: 60, lvl: "Dispatch soon", tone: "bg-amber-100 text-amber-800", g: "A" },
  { c: "TOM-261116-012", v: "Tropimech · 6.5 t", s: 53, lvl: "Dispatch soon", tone: "bg-amber-100 text-amber-800", g: "B" },
];

const G: Record<string, string> = { A: "bg-forest-700 text-white", B: "bg-lime-400 text-forest-900", C: "bg-amber-400 text-amber-950" };

export function DashboardShot({ className }: { className?: string }) {
  return (
    <BrowserFrame className={className}>
      <div className="grid grid-cols-[110px_1fr] text-left">
        <div className="hidden bg-forest-950 p-3 sm:block">
          <div className="mb-4 h-3 w-16 rounded bg-lime-400/80" />
          {["Dashboard", "Batches", "Inspections", "Forecasting", "Orders", "Allocation", "Dispatch"].map((x, i) => (
            <div key={x} className={cn("mb-1.5 rounded px-2 py-1 text-[9px]", i === 0 ? "bg-white/10 text-white" : "text-forest-200/70")}>{x}</div>
          ))}
        </div>
        <div className="col-span-2 space-y-3 bg-background p-3 sm:col-span-1">
          <div className="text-[11px] font-bold text-forest-950">Operations overview</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MINI_KPIS.map((k) => (
              <div key={k.l} className="rounded-lg border bg-card p-2">
                <div className="flex items-center justify-between text-[8px] text-muted-foreground">
                  {k.l}
                  <k.i className={cn("h-2.5 w-2.5", k.warn ? "text-amber-600" : "text-forest-600")} />
                </div>
                <div className="mt-0.5 font-display text-sm font-bold">{k.v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-card p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-semibold">Priority dispatch queue</span>
              <span className="rounded-full bg-violet-50 px-1.5 text-[7px] text-violet-700">Simulated forecast</span>
            </div>
            {QUEUE.map((q) => (
              <div key={q.c} className="flex items-center gap-2 border-t py-1.5 text-[9px]">
                <span className={cn("grid h-4 w-4 place-items-center rounded text-[8px] font-bold", G[q.g])}>{q.g}</span>
                <span className="font-medium">{q.c}</span>
                <span className="hidden text-muted-foreground sm:inline">{q.v}</span>
                <span className="ml-auto h-1.5 w-12 rounded-full bg-muted">
                  <span className="block h-1.5 rounded-full bg-red-500" style={{ width: `${q.s}%` }} />
                </span>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[7px] font-medium", q.tone)}>{q.lvl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

const curve = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => {
  const s = 77.2 - 3.3 * (d + 2) * (1 + 0.025 * (d + 2)) + 7;
  return { d: `D${d}`, s: Math.round(s * 10) / 10, band: [Math.round((s - 2 - d) * 10) / 10, Math.round((s + 2 + d) * 10) / 10] };
});

export function ForecastShot({ className }: { className?: string }) {
  return (
    <BrowserFrame className={className}>
      <div className="space-y-2 bg-background p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold">TOM-261116-012 · Tropimech</div>
            <div className="text-[9px] text-muted-foreground">Ambient Bay B · 28.8°C logged</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[8px] text-violet-700"><FlaskConical className="h-2.5 w-2.5" /> Simulated forecast</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[9px]">
          <div className="rounded-md border bg-card p-1.5"><div className="text-muted-foreground">Inspection grade</div><div className="mt-0.5 font-display text-sm font-bold">B · 77.2</div></div>
          <div className="rounded-md border border-dashed bg-card p-1.5"><div className="text-muted-foreground">Predicted (3 d)</div><div className="mt-0.5 font-display text-sm font-bold text-amber-700">C · 60.1</div></div>
          <div className="rounded-md border bg-card p-1.5"><div className="text-muted-foreground">Confidence</div><div className="mt-0.5 font-display text-sm font-bold">High · 83%</div></div>
        </div>
        <div className="h-28 rounded-md border bg-card p-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
              <XAxis dataKey="d" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
              <YAxis domain={[40, 90]} tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
              <Area dataKey="band" stroke="none" fill="#bfe646" fillOpacity={0.35} isAnimationActive={false} />
              <Area dataKey="s" stroke="#215236" strokeWidth={2} fill="none" isAnimationActive={false} />
              <ReferenceLine y={65} stroke="#d97706" strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-amber-50 p-1.5 text-[9px] text-amber-800">
          <AlertTriangle className="h-3 w-3" /> May fall below Grade B in ~1.4 days. Review by tomorrow.
        </div>
      </div>
    </BrowserFrame>
  );
}

export function AllocationShot({ className }: { className?: string }) {
  const rows = [
    { o: "Greenleaf Supermarkets", g: "A", b: "TOM-261119-011", q: "6,000 kg", s: 75, c: "Good" },
    { o: "Mile 12 Produce Traders", g: "B", b: "TOM-261116-012", q: "6,500 kg", s: 88, c: "Marginal" },
    { o: "Sunbeam Processing", g: "C", b: "TOM-261115-007", q: "4,800 kg", s: 94, c: "Strong" },
  ];
  return (
    <BrowserFrame className={className}>
      <div className="space-y-2 bg-background p-4 text-left">
        <div className="text-[11px] font-bold">Recommended allocations</div>
        {rows.map((r) => (
          <div key={r.o} className="rounded-lg border bg-card p-2 text-[9px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.o}</span>
              <span className={cn("grid h-4 w-4 place-items-center rounded text-[8px] font-bold", G[r.g])}>{r.g}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <span>{r.b}</span>·<span>{r.q}</span>
              <span className="ml-auto font-medium text-forest-800">Suitability {r.s}</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              <span className="inline-flex items-center gap-0.5 rounded bg-forest-700 px-1.5 py-0.5 text-[8px] text-white"><CheckCircle2 className="h-2.5 w-2.5" /> Approve</span>
              <span className="rounded border px-1.5 py-0.5 text-[8px]">Modify</span>
              <span className="rounded border px-1.5 py-0.5 text-[8px]">Reject</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[8px]">{r.c}</span>
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}
