"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Candidate = {
  id: string; name: string; category: string; market: string; productUrl: string; evidenceUrl: string;
  salePrice: number; productCost: number; shippingCost: number; deliveryDays: number; notes: string; createdAt: string;
};

const STORAGE_KEY = "ecommerce-hunter-free-candidates-v1";
const sources = [
  { name: "Google Trends", detail: "Paieškų susidomėjimas pagal šalį ir laiką", url: "https://trends.google.com/trends/", badge: "PAKLAUSA" },
  { name: "TikTok Creative Center", detail: "Nemokami Top Ads, kūrybinės kryptys ir tendencijos", url: "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en", badge: "REKLAMOS" },
  { name: "Meta Ad Library", detail: "Viešai matomos Meta reklamos", url: "https://www.facebook.com/ads/library/", badge: "REKLAMOS" },
  { name: "Amazon Movers & Shakers", detail: "Greitai kylantys produktai Amazon rinkoje", url: "https://www.amazon.com/gp/movers-and-shakers/", badge: "PRODUKTAI" },
  { name: "Reddit paieška", detail: "Viešos diskusijos, problemos ir nusiskundimai", url: "https://www.reddit.com/search/", badge: "KOMENTARAI" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function getScreening(candidate: Candidate) {
  const landedCost = candidate.productCost + candidate.shippingCost;
  const margin = candidate.salePrice > 0 ? ((candidate.salePrice - landedCost) / candidate.salePrice) * 100 : 0;
  const blocks: string[] = [];
  if (!candidate.salePrice || !candidate.productCost) blocks.push("Trūksta kainos arba savikainos");
  if (candidate.deliveryDays > 21) blocks.push("Pristatymas viršija 21 dieną");
  if (candidate.salePrice > 0 && margin < 60) blocks.push("Bruto marža mažesnė nei 60 %");
  const state = blocks.length ? (!candidate.salePrice || !candidate.productCost ? "NEPAKANKA DUOMENŲ" : "ATMETIMO RIZIKA") : "TĘSTI TYRIMĄ";
  return { margin, landedCost, blocks, state };
}

export default function ProductHunterWorkspace() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "Sleep & Recovery", market: "US", productUrl: "", evidenceUrl: "",
    salePrice: "", productCost: "", shippingCost: "", deliveryDays: "", notes: "",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCandidates(JSON.parse(stored) as Candidate[]);
    } catch {
      setCandidates([]);
    }
  }, []);

  useEffect(() => {
    if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
  }, [candidates, saved]);

  const orderedCandidates = useMemo(() => [...candidates].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [candidates]);

  function addCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate: Candidate = {
      id: crypto.randomUUID(), name: form.name.trim(), category: form.category, market: form.market.trim() || "US",
      productUrl: form.productUrl.trim(), evidenceUrl: form.evidenceUrl.trim(), salePrice: Number(form.salePrice) || 0,
      productCost: Number(form.productCost) || 0, shippingCost: Number(form.shippingCost) || 0,
      deliveryDays: Number(form.deliveryDays) || 0, notes: form.notes.trim(), createdAt: new Date().toISOString(),
    };
    if (!candidate.name) return;
    setCandidates((current) => [candidate, ...current]);
    setSaved(true);
    setForm({ name: "", category: "Sleep & Recovery", market: "US", productUrl: "", evidenceUrl: "", salePrice: "", productCost: "", shippingCost: "", deliveryDays: "", notes: "" });
  }

  function removeCandidate(id: string) {
    setCandidates((current) => current.filter((candidate) => candidate.id !== id));
    setSaved(true);
  }

  return (
    <main className="hunter-page">
      <style>{'.hunter-page{min-height:100vh;background:#07111d;color:#edf5ff;padding:28px clamp(16px,4vw,56px) 64px;font-family:Arial,sans-serif}.hunter-wrap{max-width:1180px;margin:0 auto}.hunter-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:30px}.hunter-top a{color:#9caec2;text-decoration:none}.hunter-label{color:#65d7e8;font-size:11px;letter-spacing:.16em;font-weight:700}.hunter-page h1{font-size:clamp(30px,5vw,48px);margin:8px 0}.hunter-sub{max-width:760px;color:#9caec2;line-height:1.6}.hunter-badge{display:inline-flex;border:1px solid #24606a;background:#0e2a35;color:#8de9e9;border-radius:999px;padding:8px 12px;font-size:12px}.hunter-section{margin-top:26px;border:1px solid #1a2b3c;background:#0b1724;border-radius:18px;padding:22px}.hunter-section h2{font-size:20px;margin:0 0 6px}.hunter-muted{color:#90a3b8;font-size:13px;line-height:1.5}.hunter-sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:18px}.hunter-source{display:block;border:1px solid #20364a;border-radius:14px;padding:16px;background:#0d1c2a;color:inherit;text-decoration:none}.hunter-source:hover{border-color:#49c7d4}.hunter-source span{display:inline-block;color:#6cd9e2;font-size:10px;letter-spacing:.1em;font-weight:700;margin-bottom:10px}.hunter-source strong{display:block;margin-bottom:7px}.hunter-source small{color:#97a9bd;line-height:1.45}.hunter-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hunter-field{display:flex;flex-direction:column;gap:7px}.hunter-field.full{grid-column:1/-1}.hunter-field label{font-size:12px;color:#a9bacb}.hunter-field input,.hunter-field select,.hunter-field textarea{box-sizing:border-box;width:100%;border:1px solid #25394d;border-radius:10px;background:#07111d;color:#edf5ff;padding:11px 12px;font:inherit}.hunter-field textarea{min-height:76px;resize:vertical}.hunter-submit{border:0;border-radius:10px;padding:12px 16px;background:#39c3d2;color:#04141b;font-weight:700;cursor:pointer}.hunter-candidate{border-top:1px solid #1c2e40;margin-top:16px;padding-top:16px;display:grid;grid-template-columns:1.3fr 1fr auto;gap:15px;align-items:center}.hunter-candidate h3{margin:0 0 5px;font-size:16px}.hunter-candidate small{display:block;color:#91a5b8;margin-top:4px}.hunter-candidate a{color:#90dce5}.hunter-pill{display:inline-block;padding:6px 9px;border-radius:999px;background:#122739;color:#9bdde3;font-size:11px}.hunter-delete{border:1px solid #35475a;border-radius:9px;background:transparent;color:#b6c5d4;padding:8px 10px;cursor:pointer}.hunter-empty{padding:25px 0 6px;color:#8499ad}.hunter-notice{border-left:3px solid #e9ac57;padding:10px 13px;background:#211d16;color:#d7c39f;border-radius:0 9px 9px 0;font-size:12px;line-height:1.5;margin-top:16px}@media(max-width:720px){.hunter-top{align-items:flex-start;flex-direction:column}.hunter-grid{grid-template-columns:1fr}.hunter-candidate{grid-template-columns:1fr auto}.hunter-candidate>div:nth-child(2){grid-column:1/-1;grid-row:2}.hunter-section{padding:17px}}'}</style>
      <div className="hunter-wrap">
        <div className="hunter-top"><a href="/">← E-commerce Agent OS</a><span className="hunter-badge">NEMOKAMAS PRADŽIOS REŽIMAS</span></div>
        <p className="hunter-label">PRODUCT HUNTER · MANUAL RESEARCH START</p>
        <h1>Nemokama produktų paieškos darbo vieta</h1>
        <p className="hunter-sub">Atidaryk viešus šaltinius, įrašyk rastą produkto signalą ir iškart patikrink bazinę maržą bei pristatymo ribą. Ši versija dar pati nevykdo paieškos ir neprisijungia prie tavo paskyrų.</p>

        <section className="hunter-section">
          <h2>Nemokami šaltiniai</h2>
          <p className="hunter-muted">Atidaryk šaltinį, ieškok pagal savo kategorijos žodžius ir išsaugok produkto arba reklamos nuorodą į Hunterį.</p>
          <div className="hunter-sources">{sources.map((source) => <a className="hunter-source" href={source.url} key={source.name} target="_blank" rel="noreferrer"><span>{source.badge}</span><strong>{source.name}</strong><small>{source.detail}</small></a>)}</div>
          <div className="hunter-notice">Šaltinių skaičiai nėra pardavimų įrodymas. TikTok Top Ads rodo atrinktus pavyzdžius, o Meta biblioteka – viešas reklamas. Kiekvieno įrašo nuorodą ir stebėjimo datą saugok kaip įrodymą.</div>
        </section>

        <section className="hunter-section">
          <h2>Įtraukti kandidatą</h2>
          <p className="hunter-muted">Įrašai saugomi tik šioje naršyklėje. Skaičiavimas vyksta vietoje, be DI API ir mokamų duomenų paslaugų.</p>
          <form onSubmit={addCandidate}><div className="hunter-grid">
            <div className="hunter-field full"><label htmlFor="candidate-name">Produkto pavadinimas *</label><input id="candidate-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pvz., reguliuojama miego kaukė" /></div>
            <div className="hunter-field"><label htmlFor="candidate-category">Kategorija</label><select id="candidate-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Sleep & Recovery</option><option>Strength & Mobility</option><option>Smart Wellness</option></select></div>
            <div className="hunter-field"><label htmlFor="candidate-market">Rinka</label><input id="candidate-market" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="US" /></div>
            <div className="hunter-field full"><label htmlFor="product-url">Produkto puslapio nuoroda</label><input id="product-url" type="url" value={form.productUrl} onChange={(e) => setForm({ ...form, productUrl: e.target.value })} placeholder="https://..." /></div>
            <div className="hunter-field full"><label htmlFor="evidence-url">Reklamos, tendencijos ar diskusijos įrodymo nuoroda</label><input id="evidence-url" type="url" value={form.evidenceUrl} onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })} placeholder="TikTok, Meta, Trends, Amazon arba Reddit nuoroda" /></div>
            <div className="hunter-field"><label htmlFor="sale-price">Planuojama pardavimo kaina (USD)</label><input id="sale-price" type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} placeholder="79.00" /></div>
            <div className="hunter-field"><label htmlFor="product-cost">Produkto savikaina (USD)</label><input id="product-cost" type="number" min="0" step="0.01" value={form.productCost} onChange={(e) => setForm({ ...form, productCost: e.target.value })} placeholder="18.00" /></div>
            <div className="hunter-field"><label htmlFor="shipping-cost">Pristatymas iki kliento (USD)</label><input id="shipping-cost" type="number" min="0" step="0.01" value={form.shippingCost} onChange={(e) => setForm({ ...form, shippingCost: e.target.value })} placeholder="6.00" /></div>
            <div className="hunter-field"><label htmlFor="delivery-days">Pristatymo dienos</label><input id="delivery-days" type="number" min="0" step="1" value={form.deliveryDays} onChange={(e) => setForm({ ...form, deliveryDays: e.target.value })} placeholder="14" /></div>
            <div className="hunter-field full"><label htmlFor="candidate-notes">Pastabos: kas patraukė dėmesį, ką žmonės giria ar kritikuoja</label><textarea id="candidate-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Trumpai užrašyk signalą ir komentarus, kuriuos radai." /></div>
            <div className="hunter-field full"><button className="hunter-submit" type="submit">＋ Išsaugoti ir patikrinti</button></div>
          </div></form>
        </section>

        <section className="hunter-section">
          <h2>Kandidatų sąrašas <span className="hunter-muted">({orderedCandidates.length})</span></h2>
          {orderedCandidates.length === 0 ? <p className="hunter-empty">Kol kas kandidatų nėra. Pradėk nuo vieno produkto ir pridėk rastų šaltinių nuorodas.</p> : orderedCandidates.map((candidate) => {
            const result = getScreening(candidate);
            return <article className="hunter-candidate" key={candidate.id}>
              <div><h3>{candidate.name}</h3><span className="hunter-pill">{candidate.category} · {candidate.market}</span>
                {candidate.productUrl && <small><a href={candidate.productUrl} target="_blank" rel="noreferrer">Produkto puslapis ↗</a></small>}
                {candidate.evidenceUrl && <small><a href={candidate.evidenceUrl} target="_blank" rel="noreferrer">Tyrimo įrodymas ↗</a></small>}
                {candidate.notes && <small>{candidate.notes}</small>}
              </div>
              <div><strong>{result.state}</strong><small>Bruto marža: {candidate.salePrice ? result.margin.toFixed(1) + "%" : "neapskaičiuota"}</small><small>Savikaina su pristatymu: {candidate.salePrice ? money(result.landedCost) : "neįvesta"}</small><small>Pristatymas: {candidate.deliveryDays ? candidate.deliveryDays + " d." : "neįvestas"}</small>{result.blocks.map((block) => <small key={block}>• {block}</small>)}</div>
              <button className="hunter-delete" type="button" onClick={() => removeCandidate(candidate.id)}>Pašalinti</button>
            </article>;
          })}
        </section>
      </div>
    </main>
  );
}
