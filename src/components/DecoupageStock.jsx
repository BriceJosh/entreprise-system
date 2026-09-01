import { useState, useEffect, useMemo, useCallback } from 'react';
import { BACKEND_URL } from '../config/api';

export default function DecoupageStock({
  siteId,
  onDecoupageReussi
}) {
  const token = localStorage.getItem('token');

  const [stocks, setStocks] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stockIdChoisi, setStockIdChoisi] = useState('');

  const [mesureTotale, setMesureTotale] = useState('');
  const [mesureRetiree, setMesureRetiree] = useState('');
  const [nomChute, setNomChute] = useState('');
  const [prixVenteChute, setPrixVenteChute] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  /*
   * =========================================================
   * CHARGEMENT DES ARTICLES DE STOCK DU SITE
   * =========================================================
   */
  const chargerStocks = useCallback(async () => {
    if (!token) return;
    setLoadingStocks(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/stocks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStocks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Erreur chargement stocks pour découpage :', error);
    } finally {
      setLoadingStocks(false);
    }
  }, [token]);

  useEffect(() => {
    chargerStocks();
  }, [chargerStocks]);

  /*
   * Article actuellement sélectionné
   */
  const stockSelectionne = useMemo(() => {
    if (!stockIdChoisi) return null;
    return stocks.find(s => String(s._id || s.id) === String(stockIdChoisi)) || null;
  }, [stocks, stockIdChoisi]);

  /*
   * Calcul automatique de la mesure restante
   */
  const { mTotale, mRetiree, mRestante, estValideMesures } = useMemo(() => {
    const tot = parseFloat(String(mesureTotale).replace(',', '.'));
    const ret = parseFloat(String(mesureRetiree).replace(',', '.'));

    const valTot = !isNaN(tot) && tot > 0 ? tot : 0;
    const valRet = !isNaN(ret) && ret > 0 ? ret : 0;
    const res = valTot > 0 && valRet > 0 ? Number((valTot - valRet).toFixed(2)) : 0;
    const valide = valTot > 0 && valRet > 0 && valRet <= valTot;

    return {
      mTotale: valTot,
      mRetiree: valRet,
      mRestante: res,
      estValideMesures: valide
    };
  }, [mesureTotale, mesureRetiree]);

  /*
   * Mise à jour automatique de la suggestion du nom de la chute
   */
  useEffect(() => {
    if (stockSelectionne && mRestante > 0) {
      setNomChute(`${stockSelectionne.nom_article} - Reste ${mRestante}m`);
    } else {
      setNomChute('');
    }
  }, [stockSelectionne, mRestante]);

  /*
   * =========================================================
   * SOUMISSION DU DÉCOUPAGE
   * =========================================================
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!stockSelectionne) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un article à découper.' });
      return;
    }

    if (Number(stockSelectionne.quantite) < 1) {
      setMessage({ type: 'error', text: 'Stock insuffisant pour cet article.' });
      return;
    }

    if (!estValideMesures) {
      setMessage({
        type: 'error',
        text: 'Veuillez vérifier les mesures (la mesure retirée ne peut pas dépasser la mesure totale).'
      });
      return;
    }

    if (mRestante > 0 && (!prixVenteChute || Number(prixVenteChute) <= 0)) {
      setMessage({
        type: 'error',
        text: 'Veuillez renseigner le prix de vente pour la mesure restante (chute).'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/stocks/decoupage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stock_id: stockSelectionne._id || stockSelectionne.id,
          mesure_totale: mTotale,
          mesure_retiree: mRetiree,
          nom_article_chute: nomChute.trim(),
          prix_vente_chute: Number(prixVenteChute) || 0,
          description: description.trim(),
          site_id: siteId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l’enregistrement du découpage.');
      }

      setMessage({
        type: 'success',
        text: data.message || 'Découpage enregistré avec succès.'
      });

      // Réinitialiser les champs
      setStockIdChoisi('');
      setMesureTotale('');
      setMesureRetiree('');
      setNomChute('');
      setPrixVenteChute('');
      setDescription('');

      await chargerStocks();
      onDecoupageReussi?.(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-black text-gray-800">
            Découpage d'articles (Bâches & Autocollants)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Découpez une portion de stock et enregistrez automatiquement le restant.
          </p>
        </div>
      </div>

      {message.text && (
        <div
          className={`p-3.5 mb-5 rounded-xl text-xs font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. SELECTION DE L'ARTICLE EN STOCK */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-gray-500">
              Article à découper (provenant du stock)
            </label>
            {loadingStocks && (
              <span className="text-[11px] text-gray-400 font-semibold">
                Chargement...
              </span>
            )}
          </div>

          <select
            value={stockIdChoisi}
            onChange={e => setStockIdChoisi(e.target.value)}
            className="w-full p-3 rounded-xl border bg-gray-50 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">-- Choisir un article en stock --</option>
            {stocks.map(s => {
              const qte = Number(s.quantite) || 0;
              const id = s._id || s.id;
              return (
                <option key={id} value={id} disabled={qte < 1}>
                  {s.nom_article} (En stock: {qte}) {qte < 1 ? '- Épuisé' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* DETAILS DE L'ARTICLE SELECTIONNE */}
        {stockSelectionne && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-900 font-bold">
                {stockSelectionne.nom_article}
              </span>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Quantité en stock : <strong>{stockSelectionne.quantite}</strong>
              </p>
            </div>
            <span className="text-xs font-black text-blue-900">
              Prix unitaire : {(Number(stockSelectionne.prix_vente_unite) || Number(stockSelectionne.prix_vente) || 0).toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        )}

        {/* 2. MESURES EN METRES */}
        {stockSelectionne && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Mesures (en mètres)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Mesure totale initiale (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={mesureTotale}
                  onChange={e => setMesureTotale(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-white text-sm font-bold text-gray-900"
                  placeholder="Ex: 50"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Mesure retirée / découpée (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={mesureRetiree}
                  onChange={e => setMesureRetiree(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-white text-sm font-bold text-gray-900"
                  placeholder="Ex: 15"
                  required
                />
              </div>
            </div>

            {/* CALCUL AUTOMATIQUE DE LA MESURE RESTANTE */}
            {mesureTotale && mesureRetiree && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  estValideMesures
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                    : 'bg-red-50 border-red-100 text-red-800 font-bold'
                }`}
              >
                <span>
                  {estValideMesures
                    ? `Calcul : ${mTotale}m - ${mRetiree}m = `
                    : 'Erreur : La mesure retirée dépasse la mesure totale'}
                </span>
                {estValideMesures && (
                  <span className="font-black text-sm">
                    Mesure restante : {mRestante} m
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. CONFIGURATION DE LA CHUTE / MESURE RESTANTE */}
        {stockSelectionne && estValideMesures && mRestante > 0 && (
          <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3">
            <h3 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
              Enregistrement du restant dans le stock
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Nom du nouvel article (chute / restant)
              </label>
              <input
                type="text"
                value={nomChute}
                onChange={e => setNomChute(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-purple-200 bg-white text-sm font-semibold text-gray-800"
                placeholder="Ex: Bâche 440g - Reste 35m"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Prix de vente du reste (FCFA)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={prixVenteChute}
                onChange={e => setPrixVenteChute(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-purple-200 bg-white text-sm font-bold text-purple-950"
                placeholder="Ex: 15000"
                required
              />
              <p className="text-[10px] text-gray-500 mt-0.5">
                Ce montant sera le prix de vente configuré pour ce nouvel article dans le stock.
              </p>
            </div>
          </div>
        )}

        {/* 4. NOTE / DESCRIPTION FACULTATIVE */}
        {stockSelectionne && (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Note / Précisions (facultatif)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-lg border bg-gray-50 text-sm text-gray-800"
              placeholder="Ex: Découpe pour commande client..."
            />
          </div>
        )}

        {/* 5. BOUTON DE VALIDATION */}
        {stockSelectionne && (
          <button
            type="submit"
            disabled={submitting || !estValideMesures || (mRestante > 0 && !prixVenteChute)}
            className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {submitting ? 'Traitement en cours...' : 'Valider le découpage'}
          </button>
        )}
      </form>
    </div>
  );
}
