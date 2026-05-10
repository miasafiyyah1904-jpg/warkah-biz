import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { fmt } from "@/lib/format";

type IngUnit = "kg" | "gram" | "liter" | "ml" | "unit" | "pek";
const UNITS: IngUnit[] = ["kg", "gram", "liter", "ml", "unit", "pek"];

interface Ingredient {
  id: string;
  name: string;
  qty: number;
  unit: IngUnit;
  cost: number;
}

const initialIngredients: Ingredient[] = [
  { id: "1", name: "Ayam", qty: 0.25, unit: "kg", cost: 2.5 },
  { id: "2", name: "Beras", qty: 0.15, unit: "kg", cost: 0.45 },
  { id: "3", name: "Santan", qty: 0.1, unit: "liter", cost: 0.8 },
  { id: "4", name: "Pembungkusan", qty: 1, unit: "unit", cost: 0.2 },
];

function niceRound(price: number) {
  const whole = Math.floor(price);
  const cents = Math.round((price - whole) * 100);
  if (cents === 0) return whole;
  if (cents <= 4) return whole;
  if (cents <= 50) return whole + 0.5;
  if (cents <= 54) return whole + 0.5;
  return whole + 1;
}

const addressBoss = (businessName: string) => businessName?.trim() ? businessName.trim() : "Boss";

export function PricingCalculator({
  onClose,
  businessName,
  onSave,
}: {
  onClose: () => void;
  businessName: string;
  onSave: (data: { name: string; cost: number; price: number; margin: number }) => void;
}) {
  const [productName, setProductName] = useState("Nasi Lemak Ayam");
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [rentMonthly, setRentMonthly] = useState<number | "">(900);
  const [utilMonthly, setUtilMonthly] = useState<number | "">(300);
  const [unitsPerDay, setUnitsPerDay] = useState<number | "">(80);
  const [operatingDays, setOperatingDays] = useState<number | "">(26);
  const [margin, setMargin] = useState(35);
  const [currentPrice, setCurrentPrice] = useState<number | "">("");

  const boss = addressBoss(businessName);

  // Sum of bulk ingredient costs (one batch / one day's worth of raw materials)
  const totalBatchCost = useMemo(
    () => ingredients.reduce((s, i) => s + (Number(i.cost) || 0), 0),
    [ingredients],
  );

  const units = Number(unitsPerDay) || 0;

  // Raw material cost per single unit
  const ingredientPerUnit = units > 0 ? totalBatchCost / units : 0;

  const overheadPerUnit = useMemo(() => {
    const r = Number(rentMonthly) || 0;
    const u = Number(utilMonthly) || 0;
    const days = Math.min(31, Math.max(1, Number(operatingDays) || 26));
    const dailyFixed = (r + u) / days;
    return units > 0 ? dailyFixed / units : 0;
  }, [rentMonthly, utilMonthly, units, operatingDays]);

  const totalCost = ingredientPerUnit + overheadPerUnit;
  const marginAmount = totalCost * (margin / 100);
  const suggestedRaw = totalCost + marginAmount;
  const suggestedNice = niceRound(suggestedRaw);
  const realMargin = suggestedNice > 0 ? ((suggestedNice - totalCost) / suggestedNice) * 100 : 0;

  const lossPerUnit = currentPrice !== "" && Number(currentPrice) < suggestedNice
    ? suggestedNice - Number(currentPrice)
    : 0;
  const lossDay = lossPerUnit * (Number(unitsPerDay) || 0);
  const lossMonth = lossDay * 30;
  const lossYear = lossDay * 365;

  const breakEvenUnits = marginAmount > 0
    ? Math.ceil(((Number(rentMonthly) || 0) + (Number(utilMonthly) || 0)) / marginAmount / Math.min(31, Math.max(1, Number(operatingDays) || 26)))
    : 0;

  const updateIng = (id: string, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const addIng = () => {
    setIngredients((prev) => [
      ...prev,
      { id: `i-${Date.now()}`, name: "", qty: 1, unit: "unit", cost: 0 },
    ]);
  };

  const removeIng = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSave = () => {
    if (!productName.trim()) {
      toast.error("Boss, isi nama produk dulu ya 😊");
      return;
    }
    onSave({
      name: productName,
      cost: totalCost,
      price: suggestedNice,
      margin: realMargin,
    });
    toast.success(`${boss}, harga produk dah disimpan! ✅`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto animate-fade-in">
      <div className="mx-auto w-full max-w-full sm:max-w-[600px] md:max-w-[760px] lg:max-w-[960px] xl:max-w-[1140px] 2xl:max-w-[1280px] min-h-screen bg-background pb-32">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted tap" aria-label="Tutup">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">Kalkulator Harga Bijak</h1>
            <p className="text-xs text-muted-foreground">Masukkan kos — AI akan cadangkan harga terbaik</p>
          </div>
        </header>

        <div className="px-4 py-5 space-y-5">
          {/* Step 1 — product */}
          <section className="space-y-2">
            <Label className="text-sm font-bold">Nama Produk</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Nasi Lemak Ayam"
              className="h-12 text-base rounded-2xl"
            />
          </section>

          {/* Step 2 — ingredients */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Senarai Bahan</h2>
            <div className="space-y-2">
              {ingredients.map((ing) => (
                <div key={ing.id} className="rounded-2xl bg-card border border-border p-3 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={ing.name}
                      onChange={(e) => updateIng(ing.id, { name: e.target.value })}
                      placeholder="Nama bahan"
                      className="h-12 flex-1 rounded-xl"
                    />
                    <button
                      onClick={() => removeIng(ing.id)}
                      className="w-12 h-12 grid place-items-center rounded-xl bg-cost-soft text-cost tap"
                      aria-label="Padam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={ing.qty === 0 ? "" : ing.qty}
                      onChange={(e) => updateIng(ing.id, { qty: e.target.value === "" ? 0 : Number(e.target.value) })}
                      placeholder="Kuantiti"
                      className="h-12 rounded-xl"
                    />
                    <select
                      value={ing.unit}
                      onChange={(e) => updateIng(ing.id, { unit: e.target.value as IngUnit })}
                      className="h-12 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">RM</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={ing.cost === 0 ? "" : ing.cost}
                        onChange={(e) => updateIng(ing.id, { cost: e.target.value === "" ? 0 : Number(e.target.value) })}
                        placeholder="0.00"
                        className="h-12 rounded-xl pl-10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={addIng} variant="outline" className="w-full h-12 rounded-2xl">
              <Plus className="w-4 h-4 mr-1" /> Tambah Bahan
            </Button>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm font-medium">Jumlah Kos Bahan (Batch)</span>
              <span className="text-base font-extrabold">{fmt(totalBatchCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1 px-1">
              Ini kos bahan untuk satu batch/hari. App akan bahagikan ikut bilangan unit dijual sehari.
            </p>
          </section>

          {/* Step 3 — overheads */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Kos Operasi Harian</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Sewa tapak sebulan (RM)</Label>
                <Input
                  type="number" inputMode="decimal"
                  value={rentMonthly}
                  onChange={(e) => setRentMonthly(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Contoh: 900"
                  className="h-12 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Kos utiliti sebulan (RM)</Label>
                <Input
                  type="number" inputMode="decimal"
                  value={utilMonthly}
                  onChange={(e) => setUtilMonthly(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Contoh: 300"
                  className="h-12 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Bilangan produk dijual sehari (unit)</Label>
                <Input
                  type="number" inputMode="numeric"
                  value={unitsPerDay}
                  onChange={(e) => setUnitsPerDay(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Contoh: 80"
                  className="h-12 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Hari beroperasi sebulan</Label>
                <Input
                  type="number" inputMode="numeric" min={1} max={31}
                  value={operatingDays}
                  onChange={(e) => setOperatingDays(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Contoh: 26"
                  className="h-12 rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="text-sm font-medium">Kos overhed per unit</span>
              <span className="text-base font-extrabold">{fmt(overheadPerUnit)}</span>
            </div>
          </section>

          {/* Step 4 — margin */}
          <section className="space-y-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">Target Keuntungan {boss}</Label>
              <span className="text-sm font-extrabold text-primary">{margin}%</span>
            </div>
            <Slider
              value={[margin]}
              min={10}
              max={80}
              step={1}
              onValueChange={(v) => setMargin(v[0])}
            />
            <p className="text-xs text-muted-foreground">
              {boss} nak untung <span className="font-bold text-foreground">{margin}%</span> setiap jualan
            </p>
          </section>

          {/* AI Result */}
          <section className="rounded-2xl p-5 bg-gradient-profit text-profit-foreground shadow-glow space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
              <Sparkles className="w-4 h-4" /> Cadangan Harga AI
            </div>
            <div className="space-y-1.5 text-sm">
              <Row label="Kos Bahan/unit" value={fmt(ingredientPerUnit)} />
              <Row label="Kos Overhed/unit" value={fmt(overheadPerUnit)} />
              <Row label="Jumlah Kos/unit" value={fmt(totalCost)} />
              <Row label={`Margin (${margin}%)`} value={fmt(marginAmount)} />
            </div>
            <div className="border-t border-white/20 pt-3">
              <div className="flex items-center gap-2 text-sm font-bold opacity-90">
                <CheckCircle2 className="w-4 h-4" /> HARGA CADANGAN
              </div>
              <div className="text-4xl font-extrabold mt-1">{fmt(suggestedRaw)}</div>
              <p className="text-xs opacity-90 mt-1">Bundarkan kepada <span className="font-bold">{fmt(suggestedNice)}</span></p>
              <p className="text-xs opacity-90 mt-2">Margin Sebenar: <span className="font-bold">{realMargin.toFixed(1)}%</span></p>
            </div>
            <p className="text-xs italic opacity-95 pt-2 border-t border-white/20">
              {boss}, harga {fmt(suggestedNice)} ni sangat kompetitif dan untung pun sihat! 💚
            </p>
          </section>

          {/* Current price warning */}
          <section className="space-y-2">
            <Label className="text-sm font-bold">Harga Semasa {boss} (RM)</Label>
            <Input
              type="number" inputMode="decimal" step="0.10"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Kosongkan jika belum jual"
              className="h-12 rounded-2xl"
            />
          </section>

          {lossPerUnit > 0 && (
            <section className="rounded-2xl p-5 bg-cost-soft border-2 border-cost/30 space-y-3 animate-pop-in">
              <div className="flex items-center gap-2 text-cost font-bold">
                <AlertTriangle className="w-5 h-5" /> Amaran Harga
              </div>
              <p className="text-sm text-foreground">
                {boss} jual pada <span className="font-bold">{fmt(Number(currentPrice))}</span> sekarang.
                Itu lebih rendah dari kos + margin.
              </p>
              <div className="space-y-1.5 text-sm">
                <Row label="Kerugian per unit" value={fmt(lossPerUnit)} dark />
                <Row label="Kerugian sehari" value={`${fmt(lossDay)} (${Number(unitsPerDay) || 0} unit × ${fmt(lossPerUnit)})`} dark />
                <Row label="Kerugian sebulan" value={fmt(lossMonth)} dark />
                <Row label="Kerugian setahun" value={`${fmt(lossYear)} 😱`} dark />
              </div>
              <p className="text-xs text-muted-foreground italic">
                Naik harga {fmt(suggestedNice - Number(currentPrice))} sahaja — ramai pelanggan tidak akan kisah untuk makanan yang sedap.
              </p>
            </section>
          )}

          {/* Break-even */}
          <section className="rounded-2xl p-4 bg-warn-soft border border-warn/30">
            <p className="text-sm">
              Untuk capai break-even, {boss} perlu jual minimum{" "}
              <span className="font-extrabold text-warn">{breakEvenUnits} unit</span> sehari.
            </p>
          </section>

          {/* Save */}
          <Button onClick={handleSave} className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-profit text-profit-foreground shadow-fab">
            <Save className="w-5 h-5 mr-2" /> Simpan Harga Produk Ini
          </Button>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value, dark }: { label: string; value: string; dark?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className={dark ? "text-muted-foreground" : "opacity-90"}>{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);