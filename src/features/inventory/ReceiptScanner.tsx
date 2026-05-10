import { useRef, useState } from "react";
import { toast } from "sonner";
import { X, Check, Camera, Upload, Loader2 } from "lucide-react";
import type { Unit, ReceiptItem } from "@/types";
import { scanReceipt } from "@/lib/scanReceipt.functions";

type Phase = "pick" | "preview" | "scanning" | "result" | "error";

const KNOWN_UNITS: Unit[] = ["kg", "g", "liter", "ml", "biji", "pek", "kotak", "batang", "helai", "tong", "papan", "kampit", "ekor", "unit", "pcs", "box", "pack", "dozen"];
const normalizeUnit = (u: string): Unit => {
  const v = (u || "").toLowerCase().trim() as Unit;
  return KNOWN_UNITS.includes(v) ? v : "unit";
};

const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("read_failed"));
    r.readAsDataURL(f);
  });

type Classification = "stock" | "personal";
const MONEY_TOLERANCE = 0.10;

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const sumReceiptItems = (list: ReceiptItem[]) => roundMoney(list.reduce((sum, item) => sum + item.price, 0));

const distributeIncludedTax = (list: ReceiptItem[], amount: number): ReceiptItem[] => {
  const centsToAdd = Math.round(amount * 100);
  if (!list.length || centsToAdd <= 0) return list;

  const baseCents = list.map((item) => Math.round(item.price * 100));
  const totalCents = baseCents.reduce((sum, cents) => sum + Math.max(cents, 0), 0);
  const weighted = list.map((_, idx) => {
    const weight = totalCents > 0 ? Math.max(baseCents[idx], 0) / totalCents : 1 / list.length;
    const exact = weight * centsToAdd;
    return { idx, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let allocated = weighted.reduce((sum, item) => sum + item.cents, 0);
  weighted.sort((a, b) => b.fraction - a.fraction).forEach((item) => {
    if (allocated < centsToAdd) {
      item.cents += 1;
      allocated += 1;
    }
  });

  const addByIndex = new Map(weighted.map((item) => [item.idx, item.cents]));
  return list.map((item, idx) => ({ ...item, price: roundMoney(item.price + (addByIndex.get(idx) || 0) / 100) }));
};

export const ReceiptScanner = ({ onClose, onConfirm, knownIngredients = [] }: {
  onClose: () => void;
  onConfirm: (stockItems: ReceiptItem[], personalItems: ReceiptItem[]) => void;
  knownIngredients?: string[];
}) => {
  const [phase, setPhase] = useState<Phase | "classify">("pick");
  const [classifyMap, setClassifyMap] = useState<Record<number, Classification>>({});
  const [imageUrl, setImageUrl] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [tax, setTax] = useState<number>(0);
  const [receiptTotal, setReceiptTotal] = useState<number>(0);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [errMsg, setErrMsg] = useState<string>("");
  const [mismatchWarn, setMismatchWarn] = useState<null | { sum: number; receipt: number; diff: number }>(null);
  const [includedTaxAdjustment, setIncludedTaxAdjustment] = useState<null | { amount: number; rawSum: number; adjustedSum: number }>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-pick same file
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Sila pilih fail gambar");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Saiz gambar terlalu besar (maks 8MB)");
      return;
    }
    try {
      const url = await fileToDataUrl(f);
      setImageUrl(url);
      setPhase("preview");
    } catch {
      toast.error("Gagal baca gambar");
    }
  };

  const doScan = async () => {
    if (!imageUrl) return;
    setPhase("scanning");
    setMismatchWarn(null);
    setIncludedTaxAdjustment(null);
    try {
      const result = await scanReceipt({ data: { imageBase64: imageUrl, mimeType: "image/jpeg", knownIngredients } });
      if (!result.ok) {
        setErrMsg(result.message || "Gagal scan resit");
        setPhase("error");
        return;
      }
      const rawParsed: ReceiptItem[] = (result.items || []).map((i: { emoji?: string; name?: string; qty?: number; unit?: string; price?: number }) => ({
        emoji: i.emoji || "🛒",
        name: i.name || "Item",
        qty: Number(i.qty) || 1,
        unit: normalizeUnit(i.unit || "unit"),
        price: roundMoney(Number(i.price) || 0),
      }));
      const printedTotal = roundMoney(result.total || 0);
      const printedTax = roundMoney(result.tax || 0);
      const rawSum = sumReceiptItems(rawParsed);
      const missingIncludedTax = printedTotal > 0 && printedTax > 0 && Math.abs(roundMoney(rawSum + printedTax - printedTotal)) <= MONEY_TOLERANCE && Math.abs(rawSum - printedTotal) > MONEY_TOLERANCE;
      const parsed = missingIncludedTax ? distributeIncludedTax(rawParsed, printedTax) : rawParsed;
      if (parsed.length === 0) {
        setErrMsg("Tiada item dijumpai. Cuba gambar yang lebih jelas.");
        setPhase("error");
        return;
      }
      setVendor(result.vendor);
      setDate(result.date);
      setTax(printedTax);
      setReceiptTotal(printedTotal);
      setItems(parsed);
      if (missingIncludedTax) {
        setIncludedTaxAdjustment({ amount: printedTax, rawSum, adjustedSum: sumReceiptItems(parsed) });
      }

      // Tax is already included in printed total (Malaysian SST/GST is a breakdown).
      // Compare sum of items directly against printed total. Tolerance: RM 0.10.
      const sum = sumReceiptItems(parsed);
      const diff = Math.abs(roundMoney(sum - printedTotal));
      if (printedTotal > 0 && diff > MONEY_TOLERANCE) {
        setMismatchWarn({ sum, receipt: printedTotal, diff });
      }
      setPhase("result");
    } catch (e) {
      console.error(e);
      setErrMsg("Masalah sambungan. Cuba lagi.");
      setPhase("error");
    }
  };

  const itemsTotal = sumReceiptItems(items);
  const total = receiptTotal > 0 ? receiptTotal : itemsTotal;

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-extrabold">Scan Resit 📷</h3>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-surface-elevated grid place-items-center tap">
          <X className="w-5 h-5" />
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {phase === "pick" && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="w-full max-w-xs space-y-3">
            <div className="text-center text-sm text-muted-foreground mb-4">
              Ambil atau muat naik gambar resit
            </div>
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full h-14 rounded-2xl bg-gradient-profit text-profit-foreground font-bold flex items-center justify-center gap-2 tap shadow-card"
            >
              <Camera className="w-5 h-5" /> Ambil Gambar
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="w-full h-14 rounded-2xl bg-surface-elevated border border-border font-bold flex items-center justify-center gap-2 tap"
            >
              <Upload className="w-5 h-5" /> Pilih dari Galeri
            </button>
          </div>
        </div>
      )}

      {phase === "preview" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl overflow-hidden bg-surface border border-border">
            <img src={imageUrl} alt="Receipt preview" className="w-full max-h-[60vh] object-contain" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setImageUrl(""); setPhase("pick"); }} className="h-12 rounded-2xl bg-surface-elevated border border-border font-bold tap">
              ↩️ Tukar Gambar
            </button>
            <button onClick={doScan} className="h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card">
              Scan Resit 🔍
            </button>
          </div>
        </div>
      )}

      {phase === "scanning" && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="relative w-full aspect-[3/4] max-w-xs rounded-3xl bg-black/60 border-2 border-dashed border-warn/50 grid place-items-center overflow-hidden">
            {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
            <span className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-warn rounded-tl-lg" />
            <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-warn rounded-tr-lg" />
            <span className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-warn rounded-bl-lg" />
            <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-warn rounded-br-lg" />
            <div className="absolute inset-x-0 h-0.5 bg-warn animate-pulse" style={{ top: "50%" }} />
            <div className="relative flex flex-col items-center gap-2 text-warn font-bold text-sm">
              <Loader2 className="w-6 h-6 animate-spin" />
              Scanning...
            </div>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          <div className="rounded-2xl bg-surface border border-profit/30 p-4 animate-pop-in">
            <div className="text-profit font-bold text-sm flex items-center gap-2">
              <Check className="w-4 h-4" /> Resit Dijumpai
            </div>
            {(vendor || date) && (
              <div className="mt-2 text-sm">
                {vendor && <div><span className="text-muted-foreground">Vendor:</span> <span className="font-semibold">{vendor}</span></div>}
                {date && <div><span className="text-muted-foreground">Tarikh:</span> <span className="font-semibold">{date}</span></div>}
              </div>
            )}
            <div className="mt-3 border-t border-border pt-3 space-y-2">
              {items.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="text-xl">{i.emoji}</span>
                  <span className="flex-1 font-semibold">{i.name}</span>
                  <span className="text-muted-foreground text-xs">{i.qty} {i.unit}</span>
                  <span className="font-bold w-20 text-right">RM {i.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jumlah item</span>
                <span className="font-semibold">RM {itemsTotal.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cukai termasuk</span>
                  <span className="font-semibold">RM {tax.toFixed(2)}</span>
                </div>
              )}
              {includedTaxAdjustment && (
                <div className="rounded-xl bg-profit/10 border border-profit/30 p-2 text-xs leading-relaxed">
                  Cukai pada resit ialah pecahan dalam jumlah. Item telah diselaraskan dari RM {includedTaxAdjustment.rawSum.toFixed(2)} ke RM {includedTaxAdjustment.adjustedSum.toFixed(2)} supaya sama dengan jumlah resit — cukai tidak ditambah dua kali.
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="font-bold uppercase text-xs tracking-wider">Jumlah pada resit</span>
                <span className="font-extrabold text-cost text-lg">RM {(receiptTotal > 0 ? receiptTotal : itemsTotal).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {mismatchWarn && (
            <div className="rounded-2xl bg-warn-soft border border-warn/40 p-4 space-y-3 animate-pop-in">
              <div className="flex items-start gap-2">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <div className="font-extrabold text-sm text-warn-foreground">
                    Jumlah tidak sepadan
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Jumlah item termasuk cukai = <b>RM {mismatchWarn.sum.toFixed(2)}</b> tetapi total resit = <b>RM {mismatchWarn.receipt.toFixed(2)}</b> (beza <b>RM {mismatchWarn.diff.toFixed(2)}</b>). Semak harga setiap item — mungkin ada yang tersalah baca (cth. RM 6.90 jadi RM 6.09).
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-surface border border-border p-2 space-y-1 max-h-56 overflow-y-auto">
                {items.map((i, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span>{i.emoji}</span>
                    <span className="flex-1 truncate font-semibold">{i.name}</span>
                    <span className="text-muted-foreground">{i.qty} {i.unit}</span>
                    <span className="font-mono font-bold w-20 text-right">RM {i.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border mt-1">
                  <span className="font-bold">Jumlah dikira</span>
                  <span className="font-mono font-extrabold">RM {mismatchWarn.sum.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">Total resit</span>
                  <span className="font-mono font-extrabold text-profit">RM {mismatchWarn.receipt.toFixed(2)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMismatchWarn(null)}
                  className="h-10 rounded-xl bg-surface border border-border text-xs font-bold tap"
                >
                  Abaikan
                </button>
                <button
                  onClick={doScan}
                  className="h-10 rounded-xl bg-warn text-warn-foreground text-xs font-bold tap"
                >
                  🔄 Scan Semula
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setPhase("pick"); setImageUrl(""); setItems([]); setMismatchWarn(null); }} className="h-12 rounded-2xl bg-surface-elevated border border-border font-bold tap">
              🔄 Scan Lain
            </button>
            <button
              onClick={() => {
                const knownSet = new Set(knownIngredients.map((n) => n.toLowerCase().trim()).filter(Boolean));
                const unknownIdx = items
                  .map((it, idx) => ({ it, idx }))
                  .filter(({ it }) => {
                    const n = it.name.toLowerCase().trim();
                    if (knownSet.has(n)) return false;
                    for (const k of knownSet) {
                      if (k && (n.includes(k) || k.includes(n))) return false;
                    }
                    return true;
                  });
                if (unknownIdx.length === 0) {
                  onConfirm(items, []);
                  return;
                }
                const initMap: Record<number, Classification> = {};
                unknownIdx.forEach(({ idx }) => { initMap[idx] = "stock"; });
                setClassifyMap(initMap);
                setPhase("classify");
              }}
              className="h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card"
            >
              Seterusnya →
            </button>
          </div>
        </div>
      )}

      {phase === "classify" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          <div className="rounded-2xl bg-warn-soft border border-warn/40 p-4">
            <div className="font-extrabold text-sm text-warn-foreground flex items-center gap-2">
              <span className="text-xl">🤔</span> Item bukan dari produk anda
            </div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Item berikut tidak padan dengan ramuan produk anda. Pilih kategori untuk setiap satu.
              Item <b>Peribadi</b> akan dikeluarkan dari rekod stok dan direkodkan sebagai <b>perbelanjaan peribadi</b>.
            </div>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => {
              if (!(idx in classifyMap)) return null;
              const choice = classifyMap[idx];
              return (
                <div key={idx} className="rounded-2xl bg-surface border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xl">{it.emoji}</span>
                    <span className="flex-1 font-bold">{it.name}</span>
                    <span className="text-xs text-muted-foreground">{it.qty} {it.unit}</span>
                    <span className="font-bold text-sm">RM {it.price.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setClassifyMap((m) => ({ ...m, [idx]: "stock" }))}
                      className={`h-10 rounded-xl text-xs font-bold tap border ${choice === "stock" ? "bg-profit text-profit-foreground border-profit" : "bg-surface-elevated border-border"}`}
                    >
                      📦 Masuk Stok
                    </button>
                    <button
                      onClick={() => setClassifyMap((m) => ({ ...m, [idx]: "personal" }))}
                      className={`h-10 rounded-xl text-xs font-bold tap border ${choice === "personal" ? "bg-cost text-white border-cost" : "bg-surface-elevated border-border"}`}
                    >
                      🧑 Peribadi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => setPhase("result")} className="h-12 rounded-2xl bg-surface-elevated border border-border font-bold tap">
              ↩️ Kembali
            </button>
            <button
              onClick={() => {
                const personalIdx = new Set(
                  Object.entries(classifyMap)
                    .filter(([, v]) => v === "personal")
                    .map(([k]) => Number(k)),
                );
                const stockItems = items.filter((_, i) => !personalIdx.has(i));
                const personalItems = items.filter((_, i) => personalIdx.has(i));
                onConfirm(stockItems, personalItems);
              }}
              className="h-12 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card"
            >
              Simpan & Kemaskini Stok ✅
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="text-center space-y-4 max-w-xs">
            <div className="text-4xl">⚠️</div>
            <div className="font-bold">{errMsg}</div>
            <button onClick={() => setPhase(imageUrl ? "preview" : "pick")} className="h-12 px-6 rounded-2xl bg-gradient-profit text-profit-foreground font-bold tap shadow-card">
              Cuba Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
