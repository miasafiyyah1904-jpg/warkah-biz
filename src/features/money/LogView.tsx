import { useMemo, useState } from "react";
import { Share2, Coins, ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { PettyEntry, Txn, OpExEntry, OpExCategory } from "@/types";
import { OPEX_CATEGORIES, OPEX_EMOJI } from "@/types";
import { fmt } from "@/lib/format";
import { useTranslation } from "@/context/LanguageContext";
import { PettyInputSheet } from "./PettyInputSheet";
import { OpExInputSheet } from "./OpExInputSheet";

const MONTHS_MS = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];

const isPeribadi = (label: string, emoji: string) =>
  emoji === "🧑" || /peribadi/i.test(label);

const dateKeyOf = (createdAt?: string, ts?: number) => {
  const d = createdAt ? new Date(createdAt) : new Date(ts ?? Date.now());
  return d.toISOString().slice(0, 10);
};

const dateOf = (createdAt?: string, ts?: number) =>
  createdAt ? new Date(createdAt) : new Date(ts ?? Date.now());

const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const weekIndexInMonth = (day: number) => {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
};

const weekRangeLabel = (year: number, month0: number, weekIdx: number) => {
  const startDay = (weekIdx - 1) * 7 + 1;
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  const endDay = weekIdx === 4 ? lastDay : weekIdx * 7;
  return `${startDay} ${MONTHS_MS[month0]} – ${endDay} ${MONTHS_MS[month0]} ${year}`;
};

const MiniStat = ({ label, value, tone }: { label: string; value: number; tone: "income" | "cost" | "profit" }) => {
  const styles = {
    income: "bg-gradient-income text-white",
    cost:   "bg-gradient-cost text-white",
    profit: "bg-gradient-profit text-profit-foreground",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ${styles}`}>
      <div className="text-[10px] font-bold uppercase opacity-90">{label}</div>
      <div className="text-base font-extrabold mt-1">{fmt(value)}</div>
    </div>
  );
};

type Filter = "all" | "in" | "out" | "petty" | "opex" | "untung";

export const LogView = ({ txns, today, week, month, petty, opex, todayCogs, todayOtherOpex, todayNetProfit, onExport, onExportReport, onAddPetty, onAddOpEx, pettyMonthlyLimit, onSavePettyLimit }: {
  txns: Txn[];
  today: { in: number; out: number; profit: number };
  week: { in: number; out: number; profit: number };
  month: { in: number; out: number; profit: number };
  petty: PettyEntry[];
  opex: OpExEntry[];
  todayCogs: number;
  todayOtherOpex: number;
  todayNetProfit: number;
  onExport: () => void;
  onExportReport: () => void;
  onAddPetty: (type: "in" | "out", amount: number, desc: string, emoji: string) => void;
  onAddOpEx: (category: OpExCategory, amount: number, desc: string, paidFromPetty: boolean) => void;
  pettyMonthlyLimit: number;
  onSavePettyLimit: (n: number) => void;
}) => {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? "en-MY" : "ms-MY";
  const [range, setRange] = useState<"today" | "week" | "month">("today");
  const [filter, setFilter] = useState<Filter>("all");
  const [pettySheet, setPettySheet] = useState<null | "in" | "out">(null);
  const [opexSheet, setOpexSheet] = useState(false);
  const [limitDraft, setLimitDraft] = useState("");
  const [editingLimit, setEditingLimit] = useState(false);
  const [expandedPeribadi, setExpandedPeribadi] = useState<Set<string>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleDate = (k: string) => setCollapsedDates(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleShowAll = (k: string) => setExpandedDates(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const sum = range === "today" ? today : range === "week" ? week : month;
  const balance = petty[petty.length - 1]?.balance ?? 0;

  // === Petty monthly tracking ===
  const nowD = new Date();
  const curMonthKey = monthKeyOf(nowD);
  const pettyUsedThisMonth = useMemo(() => {
    return petty
      .filter((p) => p.type === "out" && monthKeyOf(dateOf(p.createdAt, p.ts)) === curMonthKey && !isPeribadi(p.desc, p.emoji))
      .reduce((s, p) => s + p.amount, 0);
  }, [petty, curMonthKey]);
  const hasTopUpThisMonth = useMemo(() => {
    const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return petty.some(p => {
      if (p.type !== 'in') return false;
      const d = p.createdAt ? new Date(p.createdAt) : (p.ts ? new Date(p.ts) : null);
      if (!d) return false;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return k === key;
    });
  }, [petty]);
  const topUpDisabled = hasTopUpThisMonth && pettyMonthlyLimit > 0;
  const pettyLimitRemaining = Math.max(0, pettyMonthlyLimit - pettyUsedThisMonth);
  const pettyLimitPct = pettyMonthlyLimit > 0 ? Math.min(100, (pettyUsedThisMonth / pettyMonthlyLimit) * 100) : 0;
  const topUpNeeded = pettyMonthlyLimit > 0 ? Math.max(0, pettyMonthlyLimit - balance) : 0;

  // Group sales by date when filter === "in"
  const salesByDate = useMemo(() => {
    if (filter !== "in") return [];
    const map = new Map<string, { dateKey: string; label: string; total: number; items: Txn[] }>();
    txns.filter(t => t.type === "in").forEach(t => {
      const d = dateOf(t.createdAt, t.ts);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const cur = map.get(key) ?? { dateKey: key, label, total: 0, items: [] };
      cur.total += t.amount;
      cur.items.push(t);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filter, txns]);

  // Group all/out txns by date
  const txnsByDate = useMemo(() => {
    if (filter !== "all" && filter !== "out") return [];
    const subset = filter === "all" ? txns : txns.filter(t => t.type === "out");
    const map = new Map<string, { dateKey: string; label: string; items: Txn[]; peribadi: Txn[] }>();
    subset.forEach(t => {
      const d = dateOf(t.createdAt, t.ts);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const cur = map.get(key) ?? { dateKey: key, label, items: [], peribadi: [] };
      if (isPeribadi(t.label, t.emoji)) cur.peribadi.push(t);
      else cur.items.push(t);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map(g => ({ ...g, items: g.items.slice().reverse(), peribadi: g.peribadi.slice().reverse() }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filter, txns]);

  const opexByCategory = OPEX_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = opex.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {} as Record<OpExCategory, number>);
  const opexTotal = opex.reduce((s, e) => s + e.amount, 0);
  const grossProfit = today.in - todayCogs;

  // === Untung calculations ===
  const untungWeekly = useMemo(() => {
    type Row = { key: string; year: number; month0: number; weekIdx: number; sales: number; cogs: number; isCurrent: boolean };
    const map = new Map<string, Row>();
    const cur = new Date();
    const curKey = `${cur.getFullYear()}-${cur.getMonth()}-${weekIndexInMonth(cur.getDate())}`;

    txns.forEach(t => {
      if (isPeribadi(t.label, t.emoji)) return;
      const d = dateOf(t.createdAt, t.ts);
      const wk = weekIndexInMonth(d.getDate());
      const key = `${d.getFullYear()}-${d.getMonth()}-${wk}`;
      const row = map.get(key) ?? { key, year: d.getFullYear(), month0: d.getMonth(), weekIdx: wk, sales: 0, cogs: 0, isCurrent: key === curKey };
      if (t.type === "in") row.sales += t.amount;
      else if (t.type === "out" && t.label.startsWith("Beli ")) row.cogs += t.amount;
      map.set(key, row);
    });
    opex.forEach(e => {
      if (e.category !== "Kos Bahan") return;
      const d = dateOf(e.createdAt, e.ts);
      const wk = weekIndexInMonth(d.getDate());
      const key = `${d.getFullYear()}-${d.getMonth()}-${wk}`;
      const row = map.get(key) ?? { key, year: d.getFullYear(), month0: d.getMonth(), weekIdx: wk, sales: 0, cogs: 0, isCurrent: key === curKey };
      row.cogs += e.amount;
      map.set(key, row);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month0 !== b.month0) return b.month0 - a.month0;
      return b.weekIdx - a.weekIdx;
    });
  }, [txns, opex]);

  const untungMonthly = useMemo(() => {
    type Row = { key: string; year: number; month0: number; sales: number; cogs: number; opex: number; petty: number; isCurrent: boolean };
    const map = new Map<string, Row>();
    const cur = new Date();
    const curKey = `${cur.getFullYear()}-${cur.getMonth()}`;

    const ensure = (d: Date): Row => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const r = map.get(key) ?? { key, year: d.getFullYear(), month0: d.getMonth(), sales: 0, cogs: 0, opex: 0, petty: 0, isCurrent: key === curKey };
      map.set(key, r);
      return r;
    };

    txns.forEach(t => {
      if (isPeribadi(t.label, t.emoji)) return;
      const r = ensure(dateOf(t.createdAt, t.ts));
      if (t.type === "in") r.sales += t.amount;
      else if (t.type === "out" && t.label.startsWith("Beli ")) r.cogs += t.amount;
    });
    opex.forEach(e => {
      const r = ensure(dateOf(e.createdAt, e.ts));
      if (e.category === "Kos Bahan") r.cogs += e.amount;
      else r.opex += e.amount;
    });
    petty.forEach(p => {
      if (p.type !== "out") return;
      if (isPeribadi(p.desc, p.emoji)) return;
      const r = ensure(dateOf(p.createdAt, p.ts));
      r.petty += p.amount;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month0 - a.month0;
    });
  }, [txns, opex, petty]);

  const togglePeribadi = (key: string) => {
    setExpandedPeribadi(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="px-5 pt-6 pb-28 space-y-5">
      <header className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("recordsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("recordsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExportReport} className="h-10 px-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold tap flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> {t("reportBtn")}
          </button>
          <button onClick={onExport} className="h-10 px-3 rounded-full bg-surface border border-border text-sm font-semibold tap flex items-center gap-1.5">
            <Share2 className="w-4 h-4" /> {t("exportBtn")}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {([
          { k: "all", label: "Semua" },
          { k: "in", label: "💰 Jualan" },
          { k: "out", label: "💸 Belanja" },
          { k: "petty", label: "🪙 Petty Cash" },
          { k: "opex", label: "💼 Kos Operasi" },
          { k: "untung", label: "📈 Untung" },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`h-11 px-3 rounded-xl text-xs font-bold tap transition-all duration-150 ${filter === f.k ? "bg-gradient-profit text-profit-foreground shadow-card border-transparent" : "bg-surface border border-border text-muted-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filter === "all" || filter === "in" || filter === "out" ? (
        <>
          <div className="flex p-1 rounded-2xl bg-surface border border-border gap-1">
            {(["today", "week", "month"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 h-11 rounded-xl text-xs font-bold tap transition-all duration-150 ${range === r ? "bg-gradient-profit text-profit-foreground shadow-card border-transparent" : "text-muted-foreground"}`}
              >
                {r === "today" ? t("logRangeToday") : r === "week" ? t("logRangeWeek") : t("logRangeMonth")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat label={t("colIn")}     value={sum.in}     tone="income" />
            <MiniStat label={t("colOut")}    value={sum.out}    tone="cost" />
            <MiniStat label={t("colProfit")} value={sum.profit} tone="profit" />
          </div>

          {filter === "in" ? (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("salesByDateHeader")}</h2>
              {salesByDate.length === 0 ? (
                <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                  {t("noSalesRecorded")}
                </div>
              ) : (
                salesByDate.map((group, gi) => {
                  const isCollapsed = gi === 0 ? collapsedDates.has(group.dateKey) : !expandedDates.has(`open-${group.dateKey}`);
                  const items = group.items.slice().reverse();
                  const showAll = expandedDates.has(group.dateKey);
                  const visible = showAll ? items : items.slice(0, 3);
                  const hidden = items.length - visible.length;
                  return (
                  <div key={group.dateKey} className="rounded-2xl bg-surface border border-border overflow-hidden">
                    <button
                      onClick={() => gi === 0 ? toggleDate(group.dateKey) : toggleShowAll(`open-${group.dateKey}`)}
                      className="w-full px-4 py-2.5 bg-surface-elevated flex items-center justify-between tap"
                    >
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        📅 {group.label}
                      </span>
                      <span className="font-extrabold text-profit">+{fmt(group.total)}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {visible.map(t => (
                          <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                            <span className="text-xl">{t.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{t.label}</div>
                              <div className="text-[11px] text-muted-foreground">{t.time}</div>
                            </div>
                            <div className="font-bold text-sm text-profit">+{fmt(t.amount)}</div>
                          </div>
                        ))}
                        {hidden > 0 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-primary tap">
                            {t("viewMore").replace("{n}", String(hidden))}
                          </button>
                        )}
                        {showAll && items.length > 3 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-muted-foreground tap">
                            {t("collapse")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </section>
          ) : (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{t("txnsByDateHeader")}</h2>
              {txnsByDate.length === 0 ? (
                <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                  {t("noTxnsRecorded")}
                </div>
              ) : (
                txnsByDate.map((group, gi) => {
                  const dayTotal = group.items.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
                  const peribadiTotal = group.peribadi.reduce((s, t) => s + t.amount, 0);
                  const expanded = expandedPeribadi.has(group.dateKey);
                  const isCollapsed = gi === 0 ? collapsedDates.has(group.dateKey) : !expandedDates.has(`open-${group.dateKey}`);
                  const showAll = expandedDates.has(group.dateKey);
                  const visible = showAll ? group.items : group.items.slice(0, 3);
                  const hidden = group.items.length - visible.length;
                  return (
                    <div key={group.dateKey} className="rounded-2xl bg-surface border border-border overflow-hidden">
                      <button
                        onClick={() => gi === 0 ? toggleDate(group.dateKey) : toggleShowAll(`open-${group.dateKey}`)}
                        className="w-full px-4 py-2.5 bg-surface-elevated flex items-center justify-between tap"
                      >
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          📅 {group.label}
                        </span>
                        <span className={`font-extrabold ${dayTotal >= 0 ? "text-profit" : "text-cost"}`}>
                          {dayTotal >= 0 ? "+" : "−"}{fmt(Math.abs(dayTotal))}
                        </span>
                      </button>
                      {!isCollapsed && (
                      <div className="divide-y divide-border">
                        {visible.map(t => (
                          <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                            <span className="text-xl">{t.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{t.label}</div>
                              <div className="text-[11px] text-muted-foreground">{t.time}</div>
                            </div>
                            <div className={`font-bold text-sm ${t.type === "in" ? "text-profit" : "text-cost"}`}>
                              {t.type === "in" ? "+" : "−"}{fmt(t.amount)}
                            </div>
                          </div>
                        ))}
                        {hidden > 0 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-primary tap">
                            {t("viewMore").replace("{n}", String(hidden))}
                          </button>
                        )}
                        {showAll && group.items.length > 3 && (
                          <button onClick={() => toggleShowAll(group.dateKey)} className="w-full px-4 py-2.5 text-xs font-bold text-muted-foreground tap">
                            {t("collapse")}
                          </button>
                        )}
                        {group.peribadi.length > 0 && (
                          <>
                            <button
                              onClick={() => togglePeribadi(group.dateKey)}
                              className="w-full px-4 py-2.5 flex items-center gap-3 tap text-left bg-surface-elevated/40"
                            >
                              {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              <span className="text-xl">🧑</span>
                              <div className="flex-1">
                                <div className="text-sm font-semibold">Peribadi</div>
                                <div className="text-[11px] text-muted-foreground">{group.peribadi.length} item · tidak dikira dalam untung</div>
                              </div>
                              <div className="font-bold text-sm text-muted-foreground">−{fmt(peribadiTotal)}</div>
                            </button>
                            {expanded && group.peribadi.map(t => (
                              <div key={t.id} className="px-4 py-2 pl-12 flex items-center gap-3 bg-surface-elevated/20">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs truncate text-muted-foreground">{t.label.replace(/^Peribadi:\s*/i, "")}</div>
                                </div>
                                <div className="font-semibold text-xs text-muted-foreground">−{fmt(t.amount)}</div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          )}
        </>
      ) : filter === "petty" ? (
        <>
          {/* Setup prompt when both monthly limit AND wallet balance are zero */}
          {pettyMonthlyLimit === 0 && balance === 0 && !editingLimit && petty.length === 0 ? (
            <div className="rounded-3xl p-5 bg-gradient-to-br from-warn/30 to-warn/10 border border-warn/30 space-y-4 animate-pop-in">
              <div className="text-center space-y-1">
                <div className="text-3xl">🪙</div>
                <h3 className="font-extrabold text-base">Mulakan Petty Cash Anda</h3>
                <p className="text-xs text-muted-foreground">Ikut 2 langkah mudah untuk mula</p>
              </div>
              <button
                onClick={() => { setLimitDraft(""); setEditingLimit(true); }}
                className="w-full rounded-2xl p-4 bg-surface border border-border tap text-left flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-primary/15 grid place-items-center text-sm font-extrabold text-primary">1</div>
                <div className="flex-1">
                  <div className="font-bold text-sm">Tetapkan had bulanan</div>
                  <div className="text-[11px] text-muted-foreground">Kawal perbelanjaan setiap bulan</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setPettySheet("in")}
                className="w-full rounded-2xl p-4 bg-surface border border-border tap text-left flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-profit/15 grid place-items-center text-sm font-extrabold text-profit">2</div>
                <div className="flex-1">
                  <div className="font-bold text-sm">Masuk wang untuk mula</div>
                  <div className="text-[11px] text-muted-foreground">Top-up baki petty cash</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : pettyMonthlyLimit === 0 || editingLimit ? (
            <div className="rounded-2xl p-4 bg-surface border border-border space-y-3 animate-pop-in">
              <div className="text-sm font-extrabold">⚙️ Tetapkan Had Petty Cash Bulanan</div>
              <p className="text-xs text-muted-foreground">Kawal berapa banyak boleh dibelanjakan setiap bulan.</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted-foreground">RM</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={limitDraft}
                  onChange={(e) => setLimitDraft(e.target.value)}
                  placeholder="cth: 500"
                  className="flex-1 h-12 px-3 rounded-2xl bg-surface-elevated border border-border focus:outline-none focus:border-primary text-sm font-semibold"
                />
                <button
                  onClick={() => {
                    const v = parseFloat(limitDraft) || 0;
                    if (v < 0) return;
                    onSavePettyLimit(v);
                    setEditingLimit(false);
                    setLimitDraft("");
                  }}
                  className="h-12 px-5 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap"
                >
                  Simpan
                </button>
              </div>
              {editingLimit && (
                <button onClick={() => { setEditingLimit(false); setLimitDraft(""); }} className="text-xs text-muted-foreground tap">Batal</button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl p-4 bg-surface border border-border space-y-3 animate-pop-in">
              <div className="flex items-center justify-between">
                <div className="text-sm font-extrabold">🪙 Had Petty Cash Bulan Ini</div>
                <button onClick={() => { setEditingLimit(true); setLimitDraft(String(pettyMonthlyLimit)); }} className="text-[11px] font-bold text-primary tap">Tukar Had</button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Diperuntukkan</div>
                  <div className="font-extrabold text-base">RM {pettyMonthlyLimit.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Digunakan</div>
                  <div className="font-extrabold text-base text-cost">RM {pettyUsedThisMonth.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Baki</div>
                  <div className="font-extrabold text-base text-profit">RM {pettyLimitRemaining.toFixed(2)}</div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                <div className={`h-full transition-all ${pettyLimitPct >= 100 ? "bg-cost" : pettyLimitPct >= 80 ? "bg-warn" : "bg-profit"}`} style={{ width: `${pettyLimitPct}%` }} />
              </div>
            </div>
          )}

          {pettyMonthlyLimit > 0 && topUpNeeded > 0 && (
            <div className="rounded-2xl p-4 bg-warn/10 border border-warn/30 space-y-2 animate-pop-in">
              <div className="text-sm font-extrabold">💡 Top-up Cadangan Bulan Ini</div>
              <div className="text-xs space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Baki semasa:</span><span className="font-bold">RM {balance.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Had bulanan:</span><span className="font-bold">RM {pettyMonthlyLimit.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tambah:</span><span className="font-extrabold text-warn">RM {topUpNeeded.toFixed(2)}</span></div>
              </div>
              <button
                onClick={topUpDisabled ? undefined : () => setPettySheet("in")}
                disabled={topUpDisabled}
                className={`w-full h-11 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap text-sm ${topUpDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Top-up Sekarang
              </button>
            </div>
          )}

          <div className="rounded-3xl p-5 bg-gradient-to-br from-warn/30 to-warn/10 border border-warn/30 text-center animate-pop-in">
            <Coins className="w-6 h-6 mx-auto text-warn" />
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-2">Wang Runcit / Petty Cash</div>
            <div className="text-4xl font-extrabold mt-1">RM {balance.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Baki semasa dalam tangan</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={topUpDisabled ? undefined : () => setPettySheet("in")}
              disabled={topUpDisabled}
              className={`h-14 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card ${topUpDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >+ Masuk Wang 💵</button>
            <button onClick={() => setPettySheet("out")} className="h-14 rounded-2xl bg-gradient-cost text-white font-bold tap shadow-card">− Keluar Wang 💸</button>
          </div>
          {topUpDisabled && (
            <p className="text-[11px] text-muted-foreground text-center -mt-1">
              Top-up hanya sekali sebulan (sudah dilakukan bulan ini)
            </p>
          )}
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Log Petty Cash</h2>
            <div className="space-y-2">
              {[...petty].reverse().map(p => (
                <div key={p.id} className="rounded-2xl p-3 bg-surface border border-border flex items-center gap-3 animate-fade-in">
                  <div className={`w-10 h-10 rounded-xl grid place-items-center text-xl ${p.type === "in" ? "bg-profit/15" : "bg-cost/15"}`}>{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.desc}</div>
                    <div className="text-[11px] text-muted-foreground">{p.time} • Baki: RM {p.balance.toFixed(2)}</div>
                  </div>
                  <div className={`font-extrabold text-sm ${p.type === "in" ? "text-profit" : "text-cost"}`}>
                    {p.type === "in" ? "+" : "−"}RM {p.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {pettySheet && (
            <PettyInputSheet
              kind={pettySheet}
              onClose={() => setPettySheet(null)}
              onSave={(amt, desc, emoji) => { onAddPetty(pettySheet, amt, desc, emoji); setPettySheet(null); }}
              monthlyLimit={pettyMonthlyLimit}
              usedThisMonth={pettyUsedThisMonth}
              alreadyToppedUpThisMonth={hasTopUpThisMonth}
            />
          )}
        </>
      ) : filter === "untung" ? (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">📊 Untung Kasar (Mingguan)</h2>
            <p className="text-[11px] text-muted-foreground px-1 -mt-2">Jualan − COGS untuk setiap minggu kalendar</p>
            {untungWeekly.length === 0 ? (
              <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                Tiada data lagi.
              </div>
            ) : untungWeekly.map(w => {
              const profit = w.sales - w.cogs;
              return (
                <div key={w.key} className="rounded-2xl p-4 bg-surface border border-border space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold">📅 Minggu {w.weekIdx} — {weekRangeLabel(w.year, w.month0, w.weekIdx)}</div>
                    {w.isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn/20 text-warn">Sedang berjalan</span>}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Jualan</span><span className="font-bold text-profit">+{fmt(w.sales)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">COGS</span><span className="font-bold text-cost">−{fmt(w.cogs)}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between text-base">
                      <span className="font-extrabold">Untung Kasar</span>
                      <span className={`font-extrabold ${profit >= 0 ? "text-profit" : "text-cost"}`}>{fmt(profit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="space-y-3 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">💼 Untung Bersih (Bulanan)</h2>
            <p className="text-[11px] text-muted-foreground px-1 -mt-2">Selepas COGS, Kos Operasi, dan Petty Cash (Peribadi tidak dikira)</p>
            {untungMonthly.length === 0 ? (
              <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                Tiada data lagi.
              </div>
            ) : untungMonthly.map(m => {
              const profit = m.sales - m.cogs - m.opex - m.petty;
              return (
                <div key={m.key} className="rounded-2xl p-4 bg-surface border border-border space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold">📅 {MONTHS_MS[m.month0]} {m.year}</div>
                    {m.isCurrent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn/20 text-warn">Sedang berjalan</span>}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>💰 Jualan</span><span className="font-bold text-profit">+{fmt(m.sales)}</span></div>
                    <div className="border-t border-border pt-1.5 flex justify-between"><span className="text-muted-foreground">🛒 COGS</span><span className="font-bold text-cost">−{fmt(m.cogs)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">💼 Kos Operasi</span><span className="font-bold text-cost">−{fmt(m.opex)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">🪙 Perbelanjaan Lain</span><span className="font-bold text-cost">−{fmt(m.petty)}</span></div>
                    <div className="border-t border-border pt-2 flex justify-between text-base">
                      <span className="font-extrabold">✅ Untung Bersih</span>
                      <span className={`font-extrabold ${profit >= 0 ? "text-profit" : "text-cost"}`}>{fmt(profit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </>
      ) : (
        <>
          {/* OPEX */}
          <div className="rounded-3xl p-5 bg-surface border border-border space-y-4 animate-pop-in">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jumlah Kos Operasi</div>
                <div className="text-3xl font-extrabold mt-1 text-cost">RM {opexTotal.toFixed(2)}</div>
              </div>
              <button
                data-tutorial="add-opex"
                onClick={() => setOpexSheet(true)}
                className="h-12 px-4 rounded-2xl bg-gradient-cost text-white font-bold shadow-card text-sm tap"
              >
                + Tambah Kos
              </button>
            </div>
            <div className="space-y-1.5 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Jualan Kasar</span>
                <span className="font-bold text-profit">+RM {today.in.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kos Bahan (COGS)</span>
                <div className="text-right">
                  <span className="font-bold text-cost">−RM {todayCogs.toFixed(2)}</span>
                  <div className="text-[10px] text-muted-foreground">Termasuk: Beli X + OpEx Kos Bahan</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border pt-1.5">
                <span className="font-semibold">Untung Kasar</span>
                <span className={`font-extrabold ${grossProfit >= 0 ? "text-profit" : "text-cost"}`}>RM {grossProfit.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kos Operasi Lain</span>
                <span className="font-bold text-cost">−RM {todayOtherOpex.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base border-t border-border pt-2">
                <span className="font-extrabold">Untung Bersih</span>
                <span className={`font-extrabold ${todayNetProfit >= 0 ? "text-profit" : "text-cost"}`}>RM {todayNetProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Pecahan Kategori</h2>
            <div className="space-y-2">
              {OPEX_CATEGORIES.map((cat) => {
                const total = opexByCategory[cat];
                const pct = opexTotal > 0 ? (total / opexTotal) * 100 : 0;
                return (
                  <div key={cat} className="rounded-2xl p-3 bg-surface border border-border flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-cost/15">
                      {OPEX_EMOJI[cat]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{cat}</span>
                        <span className="font-extrabold text-sm">RM {total.toFixed(2)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                        <div className="h-full bg-cost rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">{pct.toFixed(0)}% daripada jumlah kos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Log Kos Operasi</h2>
            {opex.length === 0 ? (
              <div className="rounded-2xl p-6 bg-surface border border-dashed border-border text-center text-sm text-muted-foreground">
                Tiada rekod lagi. Tap "+ Tambah Kos" untuk mula.
              </div>
            ) : (
              <div className="space-y-2">
                {[...opex].reverse().map((e) => (
                  <div key={e.id} className="rounded-2xl p-3 bg-surface border border-border flex items-center gap-3 animate-fade-in">
                    <div className="w-10 h-10 rounded-xl grid place-items-center text-xl bg-cost/15">
                      {OPEX_EMOJI[e.category]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{e.desc}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{e.category} • {e.time}</span>
                        {e.paidFromPetty && <span className="px-1.5 py-0.5 rounded-full bg-warn/20 text-warn font-bold">🪙 Petty Cash</span>}
                      </div>
                    </div>
                    <div className="font-extrabold text-sm text-cost">−RM {e.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {opexSheet && (
            <OpExInputSheet
              onClose={() => setOpexSheet(false)}
              onSave={(cat, amt, desc, fromPetty) => {
                onAddOpEx(cat, amt, desc, fromPetty);
                setOpexSheet(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
