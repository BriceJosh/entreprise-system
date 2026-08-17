import { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const montant = (value) => (Number(value) || 0).toLocaleString('fr-FR');

export default function CreditBanqueSection() {
  const [onglet, setOnglet] = useState('depot');
  const [depots, setDepots] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [creditAPayer, setCreditAPayer] = useState(null);
  const [paiement, setPaiement] = useState({ montant: '', reference: '' });
  const [depot, setDepot] = useState({ banque: '', montant: '', reference: '', note: '' });
  const [credit, setCredit] = useState({ fournisseur: '', designation: '', montant_total: '', reference: '', note: '' });
  const token = localStorage.getItem('token');

  const charger = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [depotsRes, creditsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/depots-banque`, { headers }),
        fetch(`${BACKEND_URL}/api/credits`, { headers })
      ]);
      if (depotsRes.ok) setDepots(await depotsRes.json());
      if (creditsRes.ok) setCredits(await creditsRes.json());
    } catch (error) {
      console.error('Erreur chargement dépôts et crédits :', error);
    }
  };

  useEffect(() => { charger(); }, [token]);

  const poster = async (url, body, succes) => {
    const response = await fetch(`${BACKEND_URL}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Enregistrement impossible.');
    setMessage({ type: 'success', text: succes });
    await charger();
  };

  const soumettreDepot = async (event) => {
    event.preventDefault(); setLoading(true); setMessage(null);
    try {
      await poster('/api/depots-banque', { ...depot, montant: Number(depot.montant) }, 'Dépôt bancaire enregistré.');
      setDepot({ banque: '', montant: '', reference: '', note: '' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); } finally { setLoading(false); }
  };

  const soumettreCredit = async (event) => {
    event.preventDefault(); setLoading(true); setMessage(null);
    try {
      await poster('/api/credits', { ...credit, montant_total: Number(credit.montant_total) }, 'Crédit fournisseur enregistré.');
      setCredit({ fournisseur: '', designation: '', montant_total: '', reference: '', note: '' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); } finally { setLoading(false); }
  };

  const soumettrePaiement = async (event, id) => {
    event.preventDefault(); setLoading(true); setMessage(null);
    try {
      await poster(`/api/credits/${id}/paiements`, { montant: Number(paiement.montant), reference: paiement.reference }, 'Paiement du crédit enregistré.');
      setPaiement({ montant: '', reference: '' }); setCreditAPayer(null);
    } catch (error) { setMessage({ type: 'error', text: error.message }); } finally { setLoading(false); }
  };

  const input = 'w-full p-2.5 border rounded-xl text-xs outline-none';

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 col-span-full">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Dépôts bancaires et crédits fournisseurs</h2>
        <p className="text-xs text-gray-400 mt-1">Dépôt : argent de l'agence versé à la banque. Crédit : achat fournisseur restant à payer.</p>
      </div>
      <div className="flex gap-2 border-b border-gray-100 pb-3">
        {[['depot', 'Dépôt bancaire'], ['credit', 'Crédit fournisseur']].map(([id, label]) => <button key={id} type="button" onClick={() => setOnglet(id)} className={`px-4 py-2 rounded-xl text-xs font-bold ${onglet === id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>)}
      </div>
      {message && <div className={`p-3 rounded-xl text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {onglet === 'depot' ? (
          <form onSubmit={soumettreDepot} className="space-y-3 p-4 rounded-xl border border-blue-100 bg-blue-50/40">
            <h3 className="text-sm font-bold">Nouveau dépôt</h3>
            <input className={input} value={depot.banque} onChange={(e) => setDepot({ ...depot, banque: e.target.value })} placeholder="Banque" />
            <input className={input} required min="1" type="number" value={depot.montant} onChange={(e) => setDepot({ ...depot, montant: e.target.value })} placeholder="Montant FCFA" />
            <input className={input} value={depot.reference} onChange={(e) => setDepot({ ...depot, reference: e.target.value })} placeholder="Référence / reçu" />
            <input className={input} value={depot.note} onChange={(e) => setDepot({ ...depot, note: e.target.value })} placeholder="Note" />
            <button disabled={loading} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">{loading ? 'Enregistrement...' : 'Enregistrer le dépôt'}</button>
          </form>
        ) : (
          <form onSubmit={soumettreCredit} className="space-y-3 p-4 rounded-xl border border-amber-100 bg-amber-50/40">
            <h3 className="text-sm font-bold">Nouvel achat à crédit</h3>
            <input className={input} required value={credit.fournisseur} onChange={(e) => setCredit({ ...credit, fournisseur: e.target.value })} placeholder="Fournisseur" />
            <input className={input} required value={credit.designation} onChange={(e) => setCredit({ ...credit, designation: e.target.value })} placeholder="Article / achat concerné" />
            <input className={input} required min="1" type="number" value={credit.montant_total} onChange={(e) => setCredit({ ...credit, montant_total: e.target.value })} placeholder="Montant total FCFA" />
            <input className={input} value={credit.reference} onChange={(e) => setCredit({ ...credit, reference: e.target.value })} placeholder="Référence" />
            <input className={input} value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} placeholder="Note" />
            <button disabled={loading} className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold disabled:opacity-50">{loading ? 'Enregistrement...' : 'Enregistrer le crédit'}</button>
          </form>
        )}

        <div className="lg:col-span-2 overflow-x-auto">
          {onglet === 'depot' ? <table className="w-full text-left text-xs text-gray-600"><thead className="bg-gray-50 uppercase text-gray-500"><tr><th className="p-3">Date</th><th className="p-3">Banque / référence</th><th className="p-3">Note</th><th className="p-3 text-right">Montant</th></tr></thead><tbody className="divide-y divide-gray-100">{depots.map((item) => <tr key={item._id}><td className="p-3">{new Date(item.date_depot || item.createdAt).toLocaleDateString('fr-FR')}</td><td className="p-3 font-semibold">{item.banque}{item.reference ? ` — ${item.reference}` : ''}</td><td className="p-3">{item.note || '-'}</td><td className="p-3 text-right font-black text-blue-700">{montant(item.montant)} FCFA</td></tr>)}{!depots.length && <tr><td colSpan="4" className="p-6 text-center text-gray-400">Aucun dépôt bancaire enregistré.</td></tr>}</tbody></table> : <table className="w-full text-left text-xs text-gray-600"><thead className="bg-gray-50 uppercase text-gray-500"><tr><th className="p-3">Fournisseur / achat</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Payé</th><th className="p-3 text-right">Reste</th><th className="p-3">Statut</th></tr></thead><tbody className="divide-y divide-gray-100">{credits.map((item) => <tr key={item._id}><td className="p-3"><strong>{item.fournisseur}</strong><br />{item.designation}</td><td className="p-3 text-right">{montant(item.montant_total)}</td><td className="p-3 text-right text-emerald-700">{montant(item.montant_paye)}</td><td className="p-3 text-right font-black text-amber-700">{montant(item.reste_a_payer)}</td><td className="p-3"><button type="button" disabled={item.statut === 'solde'} onClick={() => setCreditAPayer(creditAPayer === item._id ? null : item._id)} className="text-[10px] font-bold text-purple-700 disabled:text-gray-400">{item.statut === 'solde' ? 'Soldé' : 'Ajouter un paiement'}</button>{creditAPayer === item._id && <form onSubmit={(event) => soumettrePaiement(event, item._id)} className="mt-2 flex gap-1"><input required min="1" max={item.reste_a_payer} type="number" value={paiement.montant} onChange={(e) => setPaiement({ ...paiement, montant: e.target.value })} className="w-24 p-1 border rounded" placeholder="Montant" /><input value={paiement.reference} onChange={(e) => setPaiement({ ...paiement, reference: e.target.value })} className="w-24 p-1 border rounded" placeholder="Référence" /><button className="p-1 rounded bg-purple-600 text-white">OK</button></form>}</td></tr>)}{!credits.length && <tr><td colSpan="5" className="p-6 text-center text-gray-400">Aucun crédit fournisseur enregistré.</td></tr>}</tbody></table>}
        </div>
      </div>
    </section>
  );
}
