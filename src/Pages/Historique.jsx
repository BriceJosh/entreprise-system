import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import LogoutButton from '../components/LogoutButton';
import { formaterQuantiteVente } from '../utils/formatStock';
import { BACKEND_URL } from '../config/api';

const TYPES = [
  ['tous', 'Tous les types'],
  ['vente', 'Ventes'],
  ['service', 'Services / Impressions'],
  ['depense', 'Dépenses'],
  ['stock', 'Mouvements Stock'],
  ['depot', 'Dépôts bancaires'],
  ['credit', 'Crédits fournisseurs'],
  ['paiement_credit', 'Paiements crédits']
];

const TYPE_CLASSES = {
  stock: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  vente: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  service: 'bg-blue-50 text-blue-700 border-blue-200',
  depense: 'bg-red-50 text-red-700 border-red-200',
  depot: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  credit: 'bg-amber-50 text-amber-700 border-amber-200',
  paiement_credit: 'bg-purple-50 text-purple-700 border-purple-200'
};

/**
 * Transforme n'importe quelle représentation d'un ID MongoDB en chaîne comparable.
 */
const extractId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object') {
    if (value.$oid) {
      return String(value.$oid);
    }
    if (value._id !== undefined && value._id !== null) {
      return String(value._id);
    }
    if (value.id !== undefined && value.id !== null) {
      return String(value.id);
    }
  }

  return String(value);
};



function dateLocale(date) {
  const valeur = new Date(date);
  if (Number.isNaN(valeur.getTime())) return '-';
  return valeur.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function heureLocale(date) {
  const valeur = new Date(date);
  if (Number.isNaN(valeur.getTime())) return '-';
  return valeur.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function libelleType(type) {
  return TYPES.find(([id]) => id === type)?.[1] || type;
}

function dateInput(date) {
  return date.toLocaleDateString('sv-SE');
}

export default function Historique({ profil }) {
  const aujourdHui = useMemo(() => new Date(), []);
  const debutDuMois = useMemo(
    () => new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1),
    [aujourdHui]
  );
  const estDirection =
    profil?.role === 'directeur' || profil?.role === 'admin';

  const [secretairesInscrits, setSecretairesInscrits] = useState([]);

  // "tous" = toutes les secrétaires / caisses
  const [secretaireSelectionnee, setSecretaireSelectionnee] = useState('tous');

  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  const [filtres, setFiltres] = useState({
    date_debut: dateInput(debutDuMois),
    date_fin: dateInput(aujourdHui),
    type: 'tous'
  });

  const token = localStorage.getItem('token');

  /**
   * Chargement initial de la liste officielle des secrétaires (pour la Direction)
   */
  useEffect(() => {
    if (!token || !estDirection) return;

    const chargerSecretaires = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const resSecretaires = await fetch(
          `${BACKEND_URL}/api/users/secretaires`,
          { headers }
        );

        if (resSecretaires && resSecretaires.ok) {
          const dataSecretaires = await resSecretaires.json();
          setSecretairesInscrits(
            Array.isArray(dataSecretaires) ? dataSecretaires : []
          );
        }
      } catch (err) {
        console.error('Erreur chargement secrétaires :', err);
      }
    };

    chargerSecretaires();
  }, [token, estDirection]);

  /**
   * Secrétaires disponibles (fusion comptes officiels + auteurs dans les flux)
   */
  const secretairesDisponibles = useMemo(() => {
    const secretaires = new Map();

    secretairesInscrits.forEach((secretaire) => {
      const identifiant = extractId(secretaire._id || secretaire.id);
      if (!identifiant) return;

      secretaires.set(String(identifiant), {
        id: String(identifiant),
        nom:
          secretaire.username ||
          secretaire.nom ||
          'Secrétariat'
      });
    });

    operations.forEach((item) => {
      const utilisateur = item?.utilisateur || item?.user_id;
      const identifiant = extractId(utilisateur?._id || utilisateur?.id || utilisateur);
      if (!identifiant) return;

      const dejaConnu = secretaires.has(String(identifiant));
      if (!dejaConnu) {
        secretaires.set(String(identifiant), {
          id: String(identifiant),
          nom:
            utilisateur?.nom ||
            utilisateur?.username ||
            'Secrétariat'
        });
      }
    });

    return [...secretaires.values()].sort((a, b) =>
      a.nom.localeCompare(b.nom, 'fr')
    );
  }, [secretairesInscrits, operations]);

  /**
   * Construction de la requête URL
   */
  const construireQuery = useCallback(() => {
    const query = new URLSearchParams();
    if (filtres.date_debut) query.set('date_debut', filtres.date_debut);
    if (filtres.date_fin) query.set('date_fin', filtres.date_fin);
    if (filtres.type !== 'tous') query.set('type', filtres.type);
    if (estDirection && secretaireSelectionnee !== 'tous') {
      query.set('user_id', secretaireSelectionnee);
    }
    return query;
  }, [filtres, estDirection, secretaireSelectionnee]);

  /**
   * Chargement des opérations d'historique
   *
   * Point de chargement UNIQUE : le useEffect réagit aux filtres et au
   * bouton « Appliquer les filtres » (via refreshTick). Un compteur de
   * requêtes (requeteRef) ignore les réponses qui arrivent en retard,
   * évitant qu'une ancienne réponse écrase les données à jour.
   */
  const [refreshTick, setRefreshTick] = useState(0);
  const requeteRef = useRef(0);

  useEffect(() => {
    const idCourant = ++requeteRef.current;
    setLoading(true);
    setError('');

    const fetchHistorique = async () => {
      try {
        const currentToken = localStorage.getItem('token');
        const queryStr = construireQuery().toString();
        const response = await fetch(
          `${BACKEND_URL}/api/historique?${queryStr}`,
          { headers: { Authorization: `Bearer ${currentToken}` } }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Impossible de charger l'historique.");
        }
        if (idCourant !== requeteRef.current) return; // réponse périmée
        setOperations(Array.isArray(data.operations) ? data.operations : []);
        setError('');
      } catch (err) {
        if (idCourant !== requeteRef.current) return; // réponse périmée
        setOperations([]);
        setError(err.message || "Impossible de charger l'historique.");
      } finally {
        if (idCourant === requeteRef.current) {
          setLoading(false);
        }
      }
    };

    fetchHistorique();
  }, [construireQuery, refreshTick]);

  /**
   * Raccourcis de période
   */
  const appliquerPresetPeriode = (typePreset) => {
    const now = new Date();
    let debut = new Date();
    let fin = new Date();

    if (typePreset === 'jour') {
      debut = now;
      fin = now;
    } else if (typePreset === 'semaine') {
      debut = new Date(now);
      debut.setDate(now.getDate() - 7);
      fin = now;
    } else if (typePreset === 'mois') {
      debut = new Date(now.getFullYear(), now.getMonth(), 1);
      fin = now;
    } else if (typePreset === 'annee') {
      debut = new Date(now.getFullYear(), 0, 1);
      fin = now;
    } else if (typePreset === 'tout') {
      setFiltres((prev) => ({
        ...prev,
        date_debut: '',
        date_fin: ''
      }));
      return;
    }

    setFiltres((prev) => ({
      ...prev,
      date_debut: dateInput(debut),
      date_fin: dateInput(fin)
    }));
  };

  /**
   * Téléchargement Excel / PDF
   */
  const telecharger = async (format) => {
    setExporting(format);
    setError('');
    try {
      const currentToken = localStorage.getItem('token');
      const response = await fetch(
        `${BACKEND_URL}/api/historique/export/${format}?${construireQuery().toString()}`,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Impossible de générer l'export.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `Historique_operations_${secretaireSelectionnee !== 'tous' ? secretaireSelectionnee : 'tous'}_${filtres.date_debut || 'debut'}_${filtres.date_fin || 'fin'}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Impossible de générer l'export.");
    } finally {
      setExporting('');
    }
  };

  /**
   * Calculs de résumé
   */
  const { totalEntrees, totalDepenses, totalStock, soldeNet } = useMemo(() => {
    let entrees = 0;
    let depenses = 0;
    let stock = 0;

    operations.forEach((op) => {
      const montant = Number(op.montant) || 0;
      if (op.type === 'vente' || op.type === 'service' || op.sens === 'entree') {
        entrees += montant;
      } else if (op.type === 'depense' || op.sens === 'depense' || (op.sens === 'sortie' && op.type !== 'stock')) {
        depenses += montant;
      } else if (op.type === 'stock' || op.sens === 'stock') {
        stock += montant;
      }
    });

    return {
      totalEntrees: entrees,
      totalDepenses: depenses,
      totalStock: stock,
      soldeNet: entrees - depenses
    };
  }, [operations]);

  const afficherQuantite = (operation) => {
    if (operation.quantite === null || operation.quantite === undefined) return '-';
    if (operation.type === 'vente') {
      return formaterQuantiteVente(operation.quantite, operation.option_quantite);
    }
    return `${operation.quantite}${operation.option_quantite ? ` ${operation.option_quantite}` : ''}`;
  };

  const classeMontant = (sens) => {
    if (sens === 'sortie') return 'text-red-600';
    if (sens === 'entree') return 'text-emerald-600';
    return 'text-gray-700';
  };

  const prefixeMontant = (sens) => (sens === 'sortie' ? '- ' : sens === 'entree' ? '+ ' : '');
  const retour = estDirection ? '/dashboard-directeur' : '/dashboard-secretaire';

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* ======================================================
          EN-TÊTE
      ====================================================== */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-purple-50 text-purple-600 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full">
              {estDirection ? 'Supervision Direction' : 'Traçabilité & Historique'}
            </span>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 mt-1">
              Historique des Opérations
            </h1>
            <p className="text-xs text-gray-500">
              Audit, filtrage multidimensionnel et exports de toutes les transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={retour}
              className="bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold py-2 px-4 rounded-xl text-xs uppercase transition-all"
            >
              Tableau de bord
            </Link>
            <Link
              to="/profil"
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold py-2 px-4 rounded-xl text-xs uppercase transition-all"
            >
              Profil
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* ======================================================
            BLOC FILTRES
        ====================================================== */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              🔍 Filtres de recherche
            </h2>
            {/* Presets rapides */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">
                Période rapide :
              </span>
              <button
                type="button"
                onClick={() => appliquerPresetPeriode('jour')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 text-[11px] font-semibold transition-all"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => appliquerPresetPeriode('semaine')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 text-[11px] font-semibold transition-all"
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => appliquerPresetPeriode('mois')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 text-[11px] font-semibold transition-all"
              >
                Ce mois
              </button>
              <button
                type="button"
                onClick={() => appliquerPresetPeriode('annee')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 text-[11px] font-semibold transition-all"
              >
                Année
              </button>
              <button
                type="button"
                onClick={() => appliquerPresetPeriode('tout')}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 text-[11px] font-semibold transition-all"
              >
                Tout
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${estDirection ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 items-end`}>
            {/* FILTRE SECRÉTAIRE / CAISSE (DIRECTION) */}
            {estDirection && (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                  Filtrer par secrétaire
                </label>
                <select
                  value={secretaireSelectionnee}
                  onChange={(e) => setSecretaireSelectionnee(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="tous">
                    Toutes les caisses / agents
                  </option>
                  {secretairesDisponibles.map((secretaire) => (
                    <option key={secretaire.id} value={secretaire.id}>
                      {secretaire.nom}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* FILTRE TYPE D'OPÉRATION */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Type d'opération
              </label>
              <select
                value={filtres.type}
                onChange={(e) => setFiltres({ ...filtres, type: e.target.value })}
                className="w-full p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {TYPES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* DATE DÉBUT */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Date début
              </label>
              <input
                type="date"
                value={filtres.date_debut}
                onChange={(e) => setFiltres({ ...filtres, date_debut: e.target.value })}
                className="w-full p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {/* DATE FIN */}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Date fin
              </label>
              <input
                type="date"
                value={filtres.date_fin}
                onChange={(e) => setFiltres({ ...filtres, date_fin: e.target.value })}
                className="w-full p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              disabled={loading}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              {loading ? 'Chargement en cours...' : 'Appliquer les filtres'}
            </button>
          </div>
        </section>

        {/* ======================================================
            RÉSUMÉ & KPI
        ====================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-600">
            <p className="text-xs font-bold text-gray-400 uppercase">
              Total Entrées (Recettes)
            </p>
            <p className="text-xl font-black text-gray-800 mt-2">
              {totalEntrees.toLocaleString('fr-FR')} FCFA
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-red-500">
            <p className="text-xs font-bold text-gray-400 uppercase">
              Total Dépenses Caisse
            </p>
            <p className="text-xl font-black text-gray-800 mt-2">
              {totalDepenses.toLocaleString('fr-FR')} FCFA
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-indigo-500">
            <p className="text-xs font-bold text-gray-400 uppercase">
              Entrées de Stock (Achats)
            </p>
            <p className="text-xl font-black text-gray-800 mt-2">
              {totalStock.toLocaleString('fr-FR')} FCFA
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-600">
            <p className="text-xs font-bold text-gray-400 uppercase">
              Solde Caisse (Recettes - Dépenses)
            </p>
            <p className={`text-xl font-black mt-2 ${soldeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {soldeNet.toLocaleString('fr-FR')} FCFA
            </p>
          </div>
        </section>

        {/* ======================================================
            TABLEAU DES RÉSULTATS
        ====================================================== */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                Résultats du journal ({operations.length})
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Opérations classées de la plus récente à la plus ancienne
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => telecharger('excel')}
                disabled={Boolean(exporting) || !operations.length}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {exporting === 'excel' ? 'Génération...' : 'Export Excel'}
              </button>
              <button
                type="button"
                onClick={() => telecharger('pdf')}
                disabled={Boolean(exporting) || !operations.length}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                {exporting === 'pdf' ? 'Génération...' : 'Export PDF'}
              </button>
            </div>
          </div>

          {error && (
            <div className="m-5 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
              ⚠️ {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Heure</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Site</th>
                  <th className="p-3.5">Agent</th>
                  <th className="p-3.5">Désignation & Détails</th>
                  <th className="p-3.5 text-center">Qté</th>
                  <th className="p-3.5 text-right">Prix Unitaire</th>
                  <th className="p-3.5 text-right">Montant Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {operations.map((operation) => (
                  <tr key={operation._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-3.5 font-medium text-gray-500 whitespace-nowrap">
                      {dateLocale(operation.date)}
                    </td>
                    <td className="p-3.5 font-medium text-gray-400 whitespace-nowrap">
                      {heureLocale(operation.date)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold ${
                          TYPE_CLASSES[operation.type] || 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {libelleType(operation.type)}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                        {operation.site?.nom || '-'}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-gray-700 whitespace-nowrap">
                      {operation.utilisateur?.nom || '-'}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-gray-800">
                        {operation.designation}
                      </div>
                      {operation.longueur != null && operation.largeur != null && Number(operation.longueur) > 0 && Number(operation.largeur) > 0 && (
                        <div className="text-[10px] font-semibold text-blue-600 mt-0.5">
                          Dim: {operation.longueur}m × {operation.largeur}m ({operation.surface_m2 || (operation.longueur * operation.largeur).toFixed(2)} m²)
                          {operation.prix_m2 ? ` • ${Number(operation.prix_m2).toLocaleString('fr-FR')} F/m²` : ''}
                          {operation.prix_conception && Number(operation.prix_conception) > 0 ? ` • Conception: +${Number(operation.prix_conception).toLocaleString('fr-FR')} F` : ''}
                        </div>
                      )}
                      {operation.prix_conception && Number(operation.prix_conception) > 0 && (!operation.longueur || !operation.largeur) && (
                        <div className="text-[10px] font-semibold text-blue-600 mt-0.5">
                          Conception: +{Number(operation.prix_conception).toLocaleString('fr-FR')} FCFA
                        </div>
                      )}
                      {operation.description && (!operation.longueur || !operation.largeur) && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {operation.description}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-bold text-gray-700 whitespace-nowrap">
                      {afficherQuantite(operation)}
                    </td>
                    <td className="p-3.5 text-right font-semibold text-gray-700 whitespace-nowrap">
                      {operation.prix_unitaire && Number(operation.prix_unitaire) > 0
                        ? `${Number(operation.prix_unitaire).toLocaleString('fr-FR')} FCFA`
                        : '-'}
                    </td>
                    <td className={`p-3.5 text-right font-black whitespace-nowrap ${classeMontant(operation.sens)}`}>
                      {prefixeMontant(operation.sens)}
                      {(Number(operation.montant) || 0).toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                ))}

                {!loading && !operations.length && (
                  <tr>
                    <td colSpan="9" className="p-10 text-center text-gray-400 italic">
                      Aucune opération trouvée pour ces critères de recherche.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan="9" className="p-10 text-center text-gray-400 font-medium">
                      <div className="flex justify-center items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                        <span>Chargement des données d'historique...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

