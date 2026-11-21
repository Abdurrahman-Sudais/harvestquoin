import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { CalendarCheck, Gauge, TrendingDown, TrendingUp, Minus, AlertTriangle, Info } from "lucide-react";
import { GradeBadge, SimulatedTag, ToneBadge } from "@/components/shared";
import { RISK, TREND } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import type { QualityForecast } from "@/lib/engine/forecast";
import type { ProduceCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ForecastChart({ fc, cat, height = 240 }: { fc: QualityForecast; cat: ProduceCategory; height?: number }) {
  const data = fc.curve.map((p) => ({ label: fmtDate(p.date), score: p.score, band: [p.lower, p.upper] }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis domain={[Math.max(0, Math.floor(Math.min(...fc.curve.map((c) => c.lower)) / 10) * 10 - 5), 100]} tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip
            formatter={(v: number | number[], n) => (Array.isArray(v) ? [`${v[0]} – ${v[1]}`, "Uncertainty band"] : [v, n === "score" ? "Predicted score" : n])}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area dataKey="band" stroke="none" fill="#bfe646" fillOpacity={0.35} isAnimationActive={false} />
          <Line dataKey="score" stroke="#215236" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="6 3" isAnimationActive={false} />
          {cat.grades.filter((g) => g.code !== "R").map((g) => (
            <ReferenceLine key={g.code} y={g.minScore} stroke={g.code === "A" ? "#215236" : g.code === "B" ? "#84a91e" : "#d97706"} strokeDasharray="2 4" label={{ value: `${g.code} ≥${g.minScore}`, position: "insideTopRight", fontSize: 10, fill: "#5d513b" }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastSummary({ fc, cat, compact = false }: { fc: QualityForecast; cat: ProduceCategory; compact?: boolean }) {
  const TrendIcon = fc.trend === "stable" ? Minus : fc.trend === "gradual_decline" ? TrendingDown : TrendingDown;
  return (
    <div className="space-y-4">
      <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3")}>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Current inspection grade</div>
          <div className="mt-1.5 flex items-center gap-2"><GradeBadge grade={fc.inspection!.grade} /><span className="font-display text-lg font-bold">{fc.inspection!.score}</span></div>
          <div className="mt-1 text-[11px] text-muted-foreground">Actual result · {fmtDate(fc.inspection!.date)}</div>
        </div>
        <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3">
          <div className="text-xs text-violet-700">Predicted commercial grade</div>
          <div className="mt-1.5 flex items-center gap-2"><GradeBadge grade={fc.predictedGrade} predicted /><span className="font-display text-lg font-bold">{fc.predictedScore}</span></div>
          <div className="mt-1 text-[11px] text-violet-700/80">Simulated · in {fc.horizonDays} days</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Estimated quality trend</div>
          <div className="mt-1.5 flex items-center gap-2 font-semibold"><TrendIcon className={cn("h-4 w-4", fc.trend === "stable" ? "text-forest-600" : fc.trend === "gradual_decline" ? "text-amber-600" : "text-red-600")} />{TREND[fc.trend]}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">−{fc.dailyDecay} pts/day estimated</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Acceptance-limit risk</div>
          <div className="mt-1.5"><ToneBadge tone={RISK[fc.acceptanceRisk].tone}>{RISK[fc.acceptanceRisk].label}</ToneBadge></div>
          <div className="mt-1 text-[11px] text-muted-foreground">{fc.daysToAcceptanceLimit === null ? "No grade change within 21 days" : fc.daysToAcceptanceLimit === 0 ? `Estimated below grade ${fc.inspection!.grade} already` : `~${fc.daysToAcceptanceLimit} d to grade ${fc.inspection!.grade} limit`}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Confidence level</div>
          <div className="mt-1.5 flex items-center gap-2 font-semibold"><Gauge className="h-4 w-4 text-forest-600" />{fc.confidence.level} · {fc.confidence.pct}%</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{fc.confidence.reasons[0]}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-xs text-muted-foreground">Recommended review date</div>
          <div className="mt-1.5 flex items-center gap-2 font-semibold"><CalendarCheck className="h-4 w-4 text-forest-600" />{fmtDate(fc.recommendedReviewDate, { weekday: true })}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Re-inspect to refresh the forecast</div>
        </div>
      </div>
      {!compact && (
        <>
          <ForecastChart fc={fc} cat={cat} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold">Deterioration drivers</div>
              <div className="space-y-1.5">
                {fc.drivers.map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-sm">
                    {d.factor > 1.05 ? <TrendingUp className="h-3.5 w-3.5 text-red-500" /> : d.factor < 0.95 ? <TrendingDown className="h-3.5 w-3.5 text-forest-600" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="font-medium">{d.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{d.detail}</span>
                    <span className={cn("ml-auto font-mono text-xs", d.factor > 1.05 ? "text-red-600" : d.factor < 0.95 ? "text-forest-700" : "")}>×{d.factor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Days until each grade limit (estimated)</div>
              <div className="space-y-1.5">
                {cat.grades.filter((g) => g.code !== "R").map((g) => {
                  const d = fc.daysToGradeLimit[g.code];
                  return (
                    <div key={g.code} className="flex items-center gap-2 text-sm">
                      <GradeBadge grade={g.code} size="sm" /> <span>{g.label}</span>
                      <span className="ml-auto font-medium">{d === null ? ">21 days" : d === 0 ? "Below" : `~${d} days`}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-sm font-semibold">Confidence factors</div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">{fc.confidence.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
            </div>
          </div>
        </>
      )}
      <div className="flex items-start gap-2 rounded-lg bg-violet-50 p-3 text-xs text-violet-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span><SimulatedTag className="mr-1" /> Model {fc.modelVersion}. Predicted grades are estimates for planning and are not inspection results or guaranteed shelf-life measurements.</span>
      </div>
    </div>
  );
}

export function NoForecast() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-600" /> No forecast — record an inspection for this batch first.
    </div>
  );
}
