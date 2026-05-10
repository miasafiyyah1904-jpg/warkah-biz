import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, TrendingUp, Sparkles, ShoppingCart, CheckCircle2, Clock, Trophy, ChartBar, CloudRain, AlertTriangle, Activity, LineChart as LineChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmt } from "@/lib/format";
import type { Unit, Txn, Product } from "@/types";
import { useWeather } from "@/features/weather/useWeather";
import { forecastDay, clampMultiplier } from "@/lib/forecastModel";
import { computeWeekdayStats, predictStockPrep } from "./realAggregate";
import { saveForecasts, fetchPastAccuracy } from "./forecastApi";
import { emojiForItem } from "@/lib/stockEmoji";

const DAY_NAMES_MS = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];
const MONTH_SHORT = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

type Level = "tutup" | "rendah" | "normal" | "tinggi" | "sangat-tinggi";

const LEVEL_META: Record<Level, { label: string; emoji: string; chipClass: string; cardClass: string }> = {
  "tutup": { label: "TUTUP", emoji: "⚪", chipClass: "bg-muted text-muted-foreground", cardClass: "bg-muted/40 border-border" },
  "rendah": { label: "RENDAH", emoji: "🔵", chipClass: "bg-muted text-muted-foreground", cardClass: "bg-muted/40 border-border" },
  "normal": { label: "NORMAL", emoji: "🟢", chipClass: "bg-primary/15 text-primary", cardClass: "bg-primary/5 border-primary/20" },
  "tinggi": { label: "TINGGI", emoji: "🟡", chipClass: "bg-warn-soft text-warn", cardClass: "bg-warn-soft border-warn/30" },
  "sangat-tinggi": { label: "SANGAT TINGGI", emoji: "🔴", chipClass: "bg-cost-soft text-cost", cardClass: "bg-cost-soft border-cost/30" },
};

const addressBoss = (businessName: string) => businessName?.trim() ? businessName.trim() : "Boss";

function classifyLevel(expected: number, baseline: number): Level {
  if (baseline <= 0) return "normal";
  const ratio = expected / baseline;
  if (ratio >= 1.4) return "sangat-tinggi";
  if (ratio >= 1.15) return "tinggi";
  if (ratio >= 0.85) return "normal";
  return "rendah";
}

interface DayCalc {
  dayName: string;
  dateLabel: string;
  isoDate: string;
  weekdayIdx: number; // 0=Mon
  baselineForDay: number;
  expected: number;
  low: number;
  high: number;
  probHit: number;
  level: Level;
  reasons: string[];
  weather: ReturnType<typeof useWeather>["data"] extends (infer U)[] | null ? U | undefined : undefined;
  weatherMult: number;
  stock: { emoji: string; name: string; need: number; unit: Unit }[];
}

export function SalesForecast({
  onClose,
  businessName,
  txns,
  products,
  onSendToBuy,
}: {
  onClose: () => void;
  businessName: string;
  txns: Txn[];
  products: Product[];
  onSendToBuy: (items: { emoji: string; name: string; recQty: number; unit: Unit; note?: string }[]) => void;
}) {
  const boss = addressBoss(businessName);
  const { data: weather, loading: weatherLoading, error: weatherError } = useWeather();

  // ── Real historical stats ─────────────────────────────────────────────
  const stats = useMemo(() => computeWeekdayStats(txns, 30), [txns]);
  const hasEnoughData = stats.distinctDays >= 7;

  // ── Build 7-day forward calc ──────────────────────────────────────────
  const days: DayCalc[] = useMemo(() => {
    if (!hasEnoughData) return [];
    const out: DayCalc[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const weekdayIdx = (date.getDay() === 0 ? 6 : date.getDay() - 1);
      const baselineForDay = stats.perWeekdayAvg[weekdayIdx] || stats.baseline;

      const w = weather?.[i];
      const weatherMult = clampMultiplier(1 + (w?.trafficAdjust ?? 0));
      const point = forecastDay(weekdayIdx, baselineForDay, 0.55, weatherMult, stats.noiseCV, 0.85);

      const reasons: string[] = [];
      const samples = stats.perWeekdaySamples[weekdayIdx];
      if (samples > 0) reasons.push(`Purata ${DAY_NAMES_MS[weekdayIdx]} (${samples} rekod): ${fmt(baselineForDay)}`);
      if (w && w.severity !== "ok") reasons.push(`Cuaca: ${w.label} ${w.emoji} (${w.trafficAdjust >= 0 ? "+" : ""}${Math.round(w.trafficAdjust * 100)}% trafik)`);
      if (baselineForDay > stats.baseline * 1.15) reasons.push(`${DAY_NAMES_MS[weekdayIdx]} biasanya hari sibuk Boss`);
      if (baselineForDay < stats.baseline * 0.85) reasons.push(`${DAY_NAMES_MS[weekdayIdx]} biasanya hari perlahan`);

      const stockPrep = predictStockPrep(products, point.expected, stats.baseline);
      const level = classifyLevel(point.expected, stats.baseline);

      out.push({
        dayName: DAY_NAMES_MS[weekdayIdx],
        dateLabel: `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`,
        isoDate: date.toISOString().slice(0, 10),
        weekdayIdx,
        baselineForDay,
        expected: point.expected,
        low: point.low,
        high: point.high,
        probHit: point.probHitExpected,
        level,
        reasons,
        weather: w,
        weatherMult,
        stock: stockPrep.map((s) => ({
          emoji: emojiForItem(s.name),
          name: s.name,
          need: s.qty,
          unit: s.unit,
        })),
      });
    }
    return out;
  }, [hasEnoughData, stats, weather, products]);

  // ── Save forecasts to DB once weather loaded ──────────────────────────
  useEffect(() => {
    if (!days.length || weatherLoading) return;
    saveForecasts(
      days.map((d) => ({
        forecast_date: d.isoDate,
        day_index: d.weekdayIdx,
        baseline: d.baselineForDay,
        predicted_revenue: d.expected,
        predicted_low: d.low,
        predicted_high: d.high,
        weather_adjust: d.weatherMult - 1,
        weather_label: d.weather?.label ?? null,
      })),
    ).catch(() => {});
  }, [days, weatherLoading]);

  // ── Past accuracy ─────────────────────────────────────────────────────
  const [accuracy, setAccuracy] = useState<{ avgAccuracy: number; sampleSize: number } | null>(null);
  useEffect(() => {
    fetchPastAccuracy().then(setAccuracy).catch(() => {});
  }, []);

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const detail = days.find((d) => d.isoDate === selectedIso) ?? days[0];
  const stormDay = days.find((d) => d.weather?.severity === "alert");

  const totalRevenue = useMemo(() => days.reduce((s, d) => s + d.expected, 0), [days]);
  const matCost = totalRevenue * 0.45;
  const profit = totalRevenue - matCost;

  // Aggregated weekly checklist
  const weeklyChecklist = useMemo(() => {
    const map = new Map<string, { emoji: string; name: string; total: number; unit: Unit }>();
    days.forEach((d) => d.stock.forEach((s) => {
      const cur = map.get(s.name);
      if (cur) cur.total += s.need;
      else map.set(s.name, { emoji: s.emoji, name: s.name, total: s.need, unit: s.unit });
    }));
    return Array.from(map.values())
      .map((w) => ({ ...w, total: +w.total.toFixed(1) }))
      .sort((a, b) => b.total - a.total);
  }, [days]);

  const [checked, setChecked] = useState<Set<string>>(new Set());

  const handleSendDayToBuy = () => {
    if (!detail) return;
    const items = detail.stock.map((s) => ({
      emoji: s.emoji, name: s.name, recQty: s.need, unit: s.unit,
      note: `Persiapan ${detail.dayName} ${detail.dateLabel}`,
    }));
    if (!items.length) { toast.error("Tiada ramalan stok untuk hari ini"); return; }
    onSendToBuy(items);
    toast.success(`${items.length} item ditambah ke Nak Beli ✅`);
  };

  const handleSendWeekToBuy = () => {
    const items = weeklyChecklist
      .filter((w) => !checked.has(w.name))
      .map((w) => ({ emoji: w.emoji, name: w.name, recQty: w.total, unit: w.unit, note: "Persiapan minggu" }));
    if (items.length === 0) { toast.error("Tiada item untuk dihantar"); return; }
    onSendToBuy(items);
    toast.success(`${items.length} item dihantar ke Nak Beli ✅`);
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Tutup">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">Ramalan Jualan 7 Hari</h1>
            <p className="text-xs text-muted-foreground">AI belajar dari rekod {boss}</p>
          </div>
        </header>

        {/* ── EMPTY STATE ────────────────────────────────────────── */}
        {!hasEnoughData ? (
          <div className="px-5 py-10 space-y-5">
            <div className="rounded-3xl p-6 bg-card border border-border text-center space-y-3 animate-fade-in">
              <div className="text-5xl">📊</div>
              <h2 className="text-lg font-extrabold">Belum cukup data, {boss}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI perlukan sekurang-kurangnya <span className="font-bold text-foreground">7 hari rekod jualan</span> sebelum boleh buat ramalan yang tepat.
                Setakat ini Boss dah rekod jualan untuk <span className="font-bold text-primary">{stats.distinctDays} hari</span>.
              </p>
              <div className="rounded-2xl bg-muted/40 p-4 text-left space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tips:</p>
                <p className="text-sm">• Rekodkan setiap jualan harian dalam tab <span className="font-bold">+</span></p>
                <p className="text-sm">• Lagi banyak hari direkod, lagi tepat ramalan AI</p>
                <p className="text-sm">• Selepas 7 hari, Boss akan nampak ramalan minggu depan dengan automatik 🚀</p>
              </div>
              <Button onClick={onClose} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold mt-2">
                OK, faham
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-5">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                <Sparkles className="w-3 h-3" /> Berdasarkan {stats.distinctDays} hari rekod sebenar
              </span>
              {accuracy ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-profit/10 text-profit">
                  <CheckCircle2 className="w-3 h-3" /> Ketepatan AI: {accuracy.avgAccuracy}% ({accuracy.sampleSize} ramalan lepas)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  <LineChartIcon className="w-3 h-3" /> Ketepatan akan dikira selepas beberapa minggu
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-accent/15 text-accent-foreground">
                <Activity className="w-3 h-3" /> Selang keyakinan 85% · noise {Math.round(stats.noiseCV * 100)}%
              </span>
              {weather && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-muted text-foreground">
                  ☁️ Cuaca langsung — Open-Meteo
                </span>
              )}
            </div>

            {/* Storm alert */}
            {stormDay?.weather && (
              <div className="rounded-2xl bg-cost-soft border border-cost/30 p-4 flex gap-3 animate-fade-in">
                <div className="w-10 h-10 rounded-xl bg-cost/15 grid place-items-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-cost" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-cost">
                    Amaran cuaca: {stormDay.weather.label} {stormDay.weather.emoji} pada {stormDay.dayName}
                  </p>
                  <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
                    AI menurunkan jangkaan trafik {boss} sebanyak {Math.round(Math.abs(stormDay.weather.trafficAdjust) * 100)}%.
                    Cadangan: kurangkan stok ringan dan sediakan promo last-call.
                  </p>
                </div>
              </div>
            )}
            {weatherError && (
              <p className="text-xs text-muted-foreground italic">Cuaca tidak dapat diambil — ramalan jalan tanpa pelarasan cuaca.</p>
            )}

            {/* 7-day strip */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ramalan 7 Hari</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                {days.map((d) => {
                  const meta = LEVEL_META[d.level];
                  const active = (selectedIso ?? days[0].isoDate) === d.isoDate;
                  const max = Math.max(...days.map((x) => x.expected));
                  const barPct = max > 0 ? (d.expected / max) * 100 : 0;
                  const w = d.weather;
                  return (
                    <button
                      key={d.isoDate}
                      onClick={() => setSelectedIso(d.isoDate)}
                      className={`shrink-0 w-[120px] rounded-2xl p-3 border-2 text-left tap transition-all duration-150 ${active ? "border-transparent bg-gradient-profit text-profit-foreground shadow-card scale-[1.02]" : meta.cardClass}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">{d.dayName}</p>
                          <p className="text-[10px] text-muted-foreground">{d.dateLabel}</p>
                        </div>
                        {w && <span className="text-base leading-none" title={`${w.label} · ${Math.round(w.tMax)}°`}>{w.emoji}</span>}
                      </div>
                      <span className={`mt-2 inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${meta.chipClass}`}>
                        {meta.emoji} {meta.label}
                      </span>
                      <p className="text-base font-extrabold mt-1">{fmt(d.expected)}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                        {fmt(d.low)}–{fmt(d.high)}
                      </p>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${barPct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              {weatherLoading && (
                <p className="text-[11px] text-muted-foreground italic">Mengambil cuaca terkini untuk {boss}…</p>
              )}
            </section>

            {/* Detail */}
            {detail && (
              <section className="rounded-2xl bg-card border-l-4 border-primary border-y border-r border-border p-4 shadow-card space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">📅 {detail.dayName}, {detail.dateLabel}</p>
                  <p className="text-base font-extrabold mt-1">
                    {LEVEL_META[detail.level].emoji} {LEVEL_META[detail.level].label} — Dijangka <span className="text-primary">{fmt(detail.expected)}</span>
                  </p>
                  <div className="mt-2 rounded-xl bg-accent/10 border border-accent/30 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-accent-foreground/80 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Model AI berkemungkinan
                    </p>
                    <p className="text-sm mt-1 leading-relaxed">
                      Boss, ada <span className="font-extrabold">{detail.probHit}% kemungkinan</span> capai{" "}
                      <span className="font-extrabold text-primary">{fmt(detail.expected)}</span>
                      {" "}— sediakan untuk julat <span className="font-semibold">{fmt(detail.low)}–{fmt(detail.high)}</span>.
                    </p>
                    {detail.weather && detail.weather.severity !== "ok" && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <CloudRain className="w-3 h-3" /> {detail.weather.label} {detail.weather.emoji}
                        {" "}({detail.weather.trafficAdjust >= 0 ? "+" : ""}{Math.round(detail.weather.trafficAdjust * 100)}% trafik)
                      </p>
                    )}
                  </div>
                </div>

                {detail.reasons.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sebab AI buat ramalan ini:</p>
                    <ul className="space-y-1">
                      {detail.reasons.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2"><span className="text-primary">•</span>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.stock.length > 0 ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Stok yang {boss} perlu sediakan:</p>
                    <div className="space-y-1.5">
                      {detail.stock.map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-sm rounded-xl bg-muted/40 px-3 py-2">
                          <span className="flex items-center gap-2"><span>{s.emoji}</span>{s.name}</span>
                          <span className="font-semibold">{s.need} {s.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Tiada ramalan stok — Boss belum set produk & bahan dalam Profil.
                  </p>
                )}

                {detail.stock.length > 0 && (
                  <Button onClick={handleSendDayToBuy} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold">
                    <ShoppingCart className="w-4 h-4 mr-2" /> Tambah ke Senarai Nak Beli
                  </Button>
                )}
              </section>
            )}

            {/* Pattern insights */}
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Corak dari Rekod {boss}</h2>
              {(() => {
                const idxBest = stats.perWeekdayAvg.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);
                const idxWorst = stats.perWeekdayAvg.reduce((bi, v, i, a) => (v < a[bi] ? i : bi), 0);
                return (
                  <>
                    <InsightCard icon={<Trophy className="w-5 h-5 text-warn" />}
                      title={`Hari Terbaik ${boss}`}
                      desc={`${DAY_NAMES_MS[idxBest]} adalah hari paling kuat — purata ${fmt(stats.perWeekdayAvg[idxBest])}.`}
                      bg="bg-warn-soft border-warn/30" />
                    <InsightCard icon={<Clock className="w-5 h-5 text-primary" />}
                      title="Hari Perlahan"
                      desc={`${DAY_NAMES_MS[idxWorst]} biasanya paling perlahan — purata ${fmt(stats.perWeekdayAvg[idxWorst])}. Sesuai untuk rest atau persiapan stok.`}
                      bg="bg-primary/10 border-primary/30" />
                    <InsightCard icon={<TrendingUp className="w-5 h-5 text-profit" />}
                      title="Purata Harian"
                      desc={`Sepanjang ${stats.distinctDays} hari rekod, purata jualan harian ${boss} ialah ${fmt(stats.baseline)}.`}
                      bg="bg-profit/10 border-profit/30" />
                  </>
                );
              })()}
            </section>

            {/* Weekly summary */}
            <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
                <ChartBar className="w-4 h-4" /> Jangkaan Hasil Minggu Ini
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label="Jualan dijangka" value={fmt(totalRevenue)} />
                <Row label="Kos bahan (anggaran 45%)" value={fmt(matCost)} />
                <Row label="Keuntungan dijangka" value={fmt(profit)} />
              </div>
              <p className="text-xs italic opacity-95 pt-2 border-t border-white/20">
                {boss} perlu sediakan modal beli bahan: <span className="font-bold">{fmt(matCost)}</span> sebelum minggu mula.
              </p>
            </section>

            {/* Weekly checklist */}
            {weeklyChecklist.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Senarai Persiapan Minggu Ini</h2>
                <div className="rounded-2xl bg-card border border-border p-2 shadow-sm">
                  {weeklyChecklist.map((w, i) => {
                    const isChecked = checked.has(w.name);
                    return (
                      <button
                        key={w.name}
                        onClick={() => setChecked((prev) => {
                          const next = new Set(prev);
                          if (next.has(w.name)) next.delete(w.name); else next.add(w.name);
                          return next;
                        })}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 tap text-left"
                      >
                        <div className={`w-6 h-6 rounded-md border-2 grid place-items-center transition-all ${isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                          {isChecked && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                        </div>
                        <span className="text-lg">{w.emoji}</span>
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                            Beli {w.name} — {w.total} {w.unit} {i === 0 && <span className="text-cost">(paling penting!)</span>}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button onClick={handleSendWeekToBuy} className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold">
                  <ShoppingCart className="w-4 h-4 mr-2" /> Hantar ke Nak Beli
                </Button>
              </section>
            )}

            {/* AI summary */}
            <section className="rounded-2xl p-5 bg-gradient-income text-white shadow-card space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
                <Sparkles className="w-4 h-4" /> Mesej AI
              </div>
              <p className="text-sm leading-relaxed">
                {boss}, berdasarkan {stats.distinctDays} hari rekod, minggu depan dijangka bawa pulangan sekitar <span className="font-extrabold">{fmt(totalRevenue)}</span>.
                Hari paling sibuk: <span className="font-extrabold">{days.reduce((b, d) => d.expected > b.expected ? d : b, days[0]).dayName}</span>.
              </p>
              <p className="text-sm leading-relaxed pt-2 border-t border-white/20">
                Teruskan rekod setiap hari — lagi banyak data, lagi tepat ramalan AI Boss. 💪
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="opacity-90">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

const InsightCard = ({ icon, title, desc, bg }: { icon: React.ReactNode; title: string; desc: string; bg: string }) => (
  <div className={`rounded-2xl p-4 border ${bg} flex gap-3`}>
    <div className="w-10 h-10 rounded-xl bg-background/60 grid place-items-center shrink-0">{icon}</div>
    <div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);
