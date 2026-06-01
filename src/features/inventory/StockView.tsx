import { useMemo, useState } from "react";
import { Search, X, AlertTriangle, Pencil, Check, X as XIcon } from "lucide-react";
import type { StockItem, Product } from "@/types";
import { fmtQty } from "@/lib/format";
import { emojiForItem } from "@/lib/stockEmoji";
import { levelOf } from "@/features/inventory/stockLevel";
import { useTranslation } from "@/context/LanguageContext";

const isLow = (s: StockItem) => {
  const lvl = levelOf(s);
  return lvl === "habis" || lvl === "sedikit";
};

type TFn = (key: string) => string;

const relTime = (iso: string | undefined, t: TFn): string | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return t("sv_justNow");
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return t("sv_justNow");
  if (mins < 60) return t("sv_minsAgo").replace("{n}", String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("sv_hrsAgo").replace("{n}", String(hrs));
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("sv_daysAgo").replace("{n}", String(days));
  const wks = Math.floor(days / 7);
  return t("sv_wksAgo").replace("{n}", String(wks));
};

export const StockView = ({
  stock,
  products,
  onGoToBuy,
  onSave,
}: {
  stock: StockItem[];
  products: Product[];
  onAdjust?: (id: string, delta: number) => void;
  onSave?: (item: StockItem) => void;
  onDelete?: (id: string) => void;
  onGoToBuy: () => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [stock, query]);

  const lowCount = stock.filter(isLow).length;

  if (!products || products.length === 0) {
    return (
      <div className="px-5 pt-6 pb-6">
        <header className="animate-fade-in mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("sv_stockTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("sv_stockInventorySubtitle")}</p>
        </header>
        <div className="rounded-2xl p-8 bg-surface border border-border text-center space-y-3">
          <div className="text-4xl">📭</div>
          <p className="font-bold text-sm">
            {t("sv_stockNoProducts")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 space-y-5 pb-6">
      <header className="animate-fade-in">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("sv_stockTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("sv_stockReadOnly")}
        </p>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <Chip label={t("total")} value={stock.length} tone="muted" />
        <Chip label={t("sv_stockLowLabel")} value={lowCount} tone="warn" />
      </div>

      {lowCount > 0 && (
        <button
          onClick={onGoToBuy}
          className="w-full text-left rounded-2xl p-4 bg-warn-soft border border-warn/30 flex items-center gap-3 tap animate-fade-in"
        >
          <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{t("sv_stockLowAlert").replace("{count}", String(lowCount))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("sv_checkBuy")}</p>
          </div>
        </button>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("sv_searchStockPh")}
          className="w-full h-11 pl-9 pr-9 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label={t("sv_clearSearch")}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-8 bg-surface border border-border text-center">
          <p className="text-sm text-muted-foreground">{t("sv_noItemFound")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((s) => <StockCard key={s.id} item={s} onSave={onSave} />)}
        </div>
      )}
    </div>
  );
};

const bgForCategory = (cat?: string) => {
  switch (cat) {
    case "Bahan Mentah": return "bg-emerald-100 text-emerald-700";
    case "Minuman": return "bg-sky-100 text-sky-700";
    case "Pembungkusan": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-600";
  }
};

const StockCard = ({ item, onSave }: { item: StockItem; onSave?: (item: StockItem) => void }) => {
  const { t } = useTranslation();
  const low = isLow(item);
  const restocked = relTime(item.lastRestockedAt, t);
  const used = relTime(item.lastUsedAt, t);
  const emoji = item.emoji || emojiForItem(item.name);
  const bgClass = bgForCategory(item.category);
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState<string>(String(item.qty));

  const startEdit = () => {
    setDraftQty(String(item.qty));
    setEditing(true);
  };
  const save = () => {
    const n = Number(draftQty);
    if (!Number.isFinite(n) || n < 0) return;
    onSave?.({ ...item, qty: +n.toFixed(2) });
    setEditing(false);
  };

  return (
    <div className={`rounded-2xl p-4 bg-surface border flex flex-col items-center text-center gap-2 ${low ? "border-warn/40" : "border-border"}`}>
      <div className={`w-16 h-16 rounded-2xl grid place-items-center text-3xl ${bgClass}`}>
        {emoji}
      </div>
      <div className="font-bold text-sm truncate w-full leading-tight">{item.name}</div>
      {editing ? (
        <div className="w-full space-y-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={draftQty}
            onChange={(e) => setDraftQty(e.target.value)}
            className="w-full h-9 px-2 rounded-lg border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          <div className="flex gap-1">
            <button
              onClick={save}
              className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold tap inline-flex items-center justify-center gap-1"
            >
              <Check className="w-3 h-3" /> {t("sv_saveBtn")}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 h-8 rounded-lg bg-muted text-xs font-bold tap inline-flex items-center justify-center gap-1"
            >
              <XIcon className="w-3 h-3" /> {t("no")}
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight">
            {t("sv_adjustStockHint")}
          </p>
        </div>
      ) : (
        <>
          <div className="text-xl font-extrabold">
            {fmtQty(item.qty, item.unit)}
          </div>
          {low ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warn-soft text-warn border border-warn/30 text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              {t("sv_stockLowBadge")}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">{t("sv_stockOkText")}</div>
          )}
          {onSave && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary tap"
              aria-label={t("sv_adjustStock")}
            >
              <Pencil className="w-3 h-3" /> {t("sv_adjust")}
            </button>
          )}
          {(restocked || used) && (
            <div className="w-full pt-1.5 mt-1 border-t border-border/60 space-y-0.5">
              {restocked && (
                <div className="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                  <span>{t("sv_restock")}</span>
                  <span className="font-semibold">{restocked}</span>
                </div>
              )}
              {used && (
                <div className="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                  <span>{t("sv_used")}</span>
                  <span className="font-semibold">{used}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Chip = ({ label, value, tone }: { label: string; value: number; tone: "muted" | "warn" }) => {
  const styles =
    tone === "warn"
      ? "bg-warn-soft text-warn border-warn/30"
      : "bg-surface text-foreground border-border";
  return (
    <div className={`px-3 h-9 rounded-full border flex items-center gap-2 text-xs font-bold ${styles}`}>
      <span>{label}</span>
      <span className="px-1.5 h-5 rounded-full bg-background/60 grid place-items-center min-w-5">{value}</span>
    </div>
  );
};
