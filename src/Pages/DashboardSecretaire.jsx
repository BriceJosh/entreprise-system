import { useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';
import { Link } from 'react-router-dom';

import LogoutButton from '../components/LogoutButton';
import InstallPwaButton from '../components/InstallPwaButton';
import SaisieActivite from '../components/SaisieActivite';
import SaisieStock from '../components/SaisieStock';
import CreditBanqueSection from '../components/CreditBanqueSection';
import { getPermissionFlags } from '../config/permissions';
import {
  formaterQuantiteVente,
  formaterStock
} from '../utils/formatStock';
import { BACKEND_URL } from '../config/api';

export default function DashboardSecretaire({ profil }) {
  const token = localStorage.getItem('token');

  const currentSiteId =
    profil?.site_id?._id ||
    profil?.site_id ||
    '';

  const currentUserId =
    profil?._id ||
    profil?.id ||
    '';

  const flags = useMemo(
    () => getPermissionFlags(profil),
    [profil]
  );

  const [stocks, setStocks] = useState([]);
  const [historiqueActivites, setHistoriqueActivites] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(token && currentSiteId));
  const [afficherJournal, setAfficherJournal] = useState(false);
  const [masquerChiffres, setMasquerChiffres] = useState(false);

  /*
   * =========================================================
   * CHARGEMENT DES DONNÉES
   * =========================================================
   */

  useEffect(() => {
    if (!token || !currentSiteId) {
      return undefined;
    }

    const socket = io(BACKEND_URL || undefined, {
      auth: {
        token
      }
    });

    async function chargerDonnees() {
      setLoading(true);

      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const promises = [
          fetch(
            `${BACKEND_URL}/api/activites`,
            { headers }
          ).then(async response => ({
            ok: response.ok,
            data: await response.json()
          }))
        ];

        /*
         * -----------------------------------------------------
         * STOCK
         * -----------------------------------------------------
         */

        if (flags.stockLecture) {
          promises.push(
            fetch(
              `${BACKEND_URL}/api/stocks`,
              { headers }
            ).then(async response => ({
              ok: response.ok,
              data: await response.json()
            }))
          );
        }

        const [
          activitesResult,
          stocksResult
        ] = await Promise.all(promises);

        /*
         * -----------------------------------------------------
         * ACTIVITÉS
         * -----------------------------------------------------
         */

        setHistoriqueActivites(
          activitesResult.ok &&
          Array.isArray(activitesResult.data)
            ? activitesResult.data
            : []
        );

        /*
         * -----------------------------------------------------
         * STOCKS
         * -----------------------------------------------------
         */

        if (flags.stockLecture) {
          setStocks(
            stocksResult?.ok &&
            Array.isArray(stocksResult.data)
              ? stocksResult.data
              : []
          );
        } else {
          setStocks([]);
        }

      } catch (error) {
        console.error(
          'Erreur chargement dashboard secrétaire :',
          error
        );
      } finally {
        setLoading(false);
      }
    }

    chargerDonnees();

    /*
     * =======================================================
     * SOCKET : ACTIVITÉ AJOUTÉE
     * =======================================================
     */

    const handleActivite = activite => {
      const auteurId =
        activite?.user_id?._id ||
        activite?.user_id ||
        activite?.vendeur_id;

      /*
       * Le secrétaire ne doit recevoir que ses propres
       * activités.
       */

      if (
        currentUserId &&
        String(auteurId) !== String(currentUserId)
      ) {
        return;
      }

      setHistoriqueActivites(prev => {
        if (
          prev.some(
            item => item._id === activite._id
          )
        ) {
          return prev;
        }

        return [
          activite,
          ...prev
        ].sort(
          (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
        );
      });
    };

    /*
     * =======================================================
     * SOCKET : STOCK MIS À JOUR
     * =======================================================
     */

    const handleStock = stock => {
      if (!flags.stockLecture) {
        return;
      }

      const stockSiteId =
        stock?.site_id?._id ||
        stock?.site_id;

      /*
       * On ignore les stocks appartenant à un autre site.
       */

      if (
        stockSiteId &&
        String(stockSiteId) !==
          String(currentSiteId)
      ) {
        return;
      }

      setStocks(prev => {
        const exists = prev.some(
          item => item._id === stock._id
        );

        if (exists) {
          return prev.map(item =>
            item._id === stock._id
              ? stock
              : item
          );
        }

        return [
          stock,
          ...prev
        ];
      });
    };

    socket.on(
      'activite_ajoutee',
      handleActivite
    );

    socket.on(
      'vente:nouvelle',
      data => {
        if (data?.vente) {
          handleActivite(data.vente);
        }
      }
    );

    socket.on(
      'stock_mis_a_jour',
      handleStock
    );

    return () => {
      socket.disconnect();
    };

  }, [
    token,
    currentSiteId,
    currentUserId,
    flags.stockLecture
  ]);

  /*
   * =========================================================
   * FORMAT HEURE
   * =========================================================
   */

  const formatHeure = isoDate => {
    if (!isoDate) {
      return '-';
    }

    return new Date(
      isoDate
    ).toLocaleTimeString(
      'fr-FR',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  };

  const [filtrePeriode, setFiltrePeriode] = useState('aujourd_hui');

  /*
   * =========================================================
   * ACTIVITÉS DU JOUR & TOUTES ACTIVITÉS
   * =========================================================
   */

  const activitesDuJour = useMemo(() => {
    const aujourdHui = new Date();

    return historiqueActivites.filter(item => {
      const dateVal = item.createdAt || item.created_at || item.date;
      if (!dateVal) return false;
      const date = new Date(dateVal);

      return (
        date.toDateString() ===
        aujourdHui.toDateString()
      );
    });

  }, [historiqueActivites]);

  const activitesAffichees = useMemo(() => {
    if (filtrePeriode === 'tout') {
      return historiqueActivites;
    }
    return activitesDuJour;
  }, [filtrePeriode, historiqueActivites, activitesDuJour]);

  /*
   * =========================================================
   * RECETTES
   * =========================================================
   */

  const recettes =
    activitesDuJour.reduce(
      (total, item) => {

        if (item.type === 'depense') {
          return total;
        }

        return (
          total +
          (
            Number(
              item.montant_total ??
              item.montant ??
              (
                (item.quantite || 0) *
                (item.prix_unitaire || 0)
              )
            ) || 0
          )
        );

      },
      0
    );

  /*
   * =========================================================
   * DÉPENSES
   * =========================================================
   */

  const depenses =
    activitesDuJour.reduce(
      (total, item) => {

        if (item.type !== 'depense') {
          return total;
        }

        return (
          total +
          (
            Number(
              item.montant_total ??
              item.montant ??
              item.prix_unitaire ??
              0
            ) || 0
          )
        );

      },
      0
    );

  /*
   * =========================================================
   * AFFICHAGE
   * =========================================================
   */

  return (
    <div className="min-h-screen bg-gray-50">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">

        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            <img
              src="/Logo.jpeg"
              alt="Logo Entreprise"
              className="w-10 h-10 rounded-xl object-contain border border-gray-100 p-0.5"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <h1 className="text-xl font-black text-gray-900">
                Tableau de bord
              </h1>

              <p className="text-xs text-gray-400">
                {profil?.username || 'Secrétaire'}
                {' · '}
                {profil?.poste || 'services'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() => setMasquerChiffres(prev => !prev)}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title={masquerChiffres ? "Afficher les montants" : "Masquer les montants (Mode discret)"}
            >
              <span>{masquerChiffres ? '👁️' : '🙈'}</span>
              <span className="hidden sm:inline">{masquerChiffres ? 'Afficher les montants' : 'Mode discret'}</span>
            </button>

            <InstallPwaButton role="secretaire" />

            <Link
              to="/historique"
              className="px-4 py-2 rounded-xl bg-purple-50 text-xs font-bold text-purple-700"
            >
              Historique
            </Link>

            {(flags.vente || flags.services) && (
              <Link
                to="/recus"
                className="px-4 py-2 rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700"
              >
                Reçus
              </Link>
            )}

            <Link
              to="/profil"
              className="px-4 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700"
            >
              Mon profil
            </Link>

            <LogoutButton />

          </div>

        </div>

      </header>

      {/* =====================================================
          CONTENU PRINCIPAL
          ===================================================== */}

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

        {/* ===================================================
            STATISTIQUES
            =================================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-white rounded-2xl border border-gray-100 p-5">

            <p className="text-xs text-gray-400 font-bold uppercase">
              Recettes du jour
            </p>

            <p className="text-2xl font-black text-emerald-600 mt-2">
              {masquerChiffres ? '•••••• FCFA' : `${recettes.toLocaleString()} FCFA`}
            </p>

          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">

            <p className="text-xs text-gray-400 font-bold uppercase">
              Dépenses du jour
            </p>

            <p className="text-2xl font-black text-red-600 mt-2">
              {masquerChiffres ? '•••••• FCFA' : `${depenses.toLocaleString()} FCFA`}
            </p>

          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">

            <p className="text-xs text-gray-400 font-bold uppercase">
              Solde personnel
            </p>

            <p className="text-2xl font-black text-gray-900 mt-2">
              {masquerChiffres ? '•••••• FCFA' : `${(recettes - depenses).toLocaleString()} FCFA`}
            </p>

          </div>

        </div>

        {/* ===================================================
            SAISIE ACTIVITÉ / STOCK
            =================================================== */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {(flags.services ||
            flags.vente ||
            flags.depense) && (

            <SaisieActivite
              profil={profil}
              onOperationAjoutee={operation => {

                const auteurId =
                  operation?.user_id?._id ||
                  operation?.user_id;

                if (
                  !auteurId ||
                  String(auteurId) ===
                    String(currentUserId)
                ) {

                  setHistoriqueActivites(prev => {

                    if (
                      !operation?._id ||
                      prev.some(
                        item =>
                          item._id ===
                          operation._id
                      )
                    ) {
                      return prev;
                    }

                    return [
                      operation,
                      ...prev
                    ];

                  });

                }

              }}
            />

          )}

          {flags.stockGestion && (

            <SaisieStock
              profil={profil}
              siteId={currentSiteId}
              onStockAjoute={stock => {

                setStocks(prev => {

                  const exists =
                    prev.some(
                      item =>
                        item._id ===
                        stock._id
                    );

                  return exists
                    ? prev.map(item =>
                        item._id === stock._id
                          ? stock
                          : item
                      )
                    : [
                        stock,
                        ...prev
                      ];

                });

              }}
            />

          )}

        </div>

        {/* ===================================================
            REÇUS DU JOUR (lien vers la page dédiée)
            =================================================== */}

        {(flags.vente || flags.services) && (
          <div className="mt-6">
            <Link
              to="/recus"
              className="flex items-center justify-between p-5 rounded-2xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              <div>
                <p className="text-sm font-black text-emerald-800">
                  Reçus clients
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Consulter et réimprimer les reçus du jour
                </p>
              </div>
              <span className="text-emerald-700 font-black text-lg">→</span>
            </Link>
          </div>
        )}

        {/* ===================================================
            STOCK DU SITE
            =================================================== */}

        {flags.stockLecture && (

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

            <div className="flex items-center justify-between mb-4">

              <div>

                <h2 className="text-lg font-black text-gray-800">
                  Stock du site
                </h2>

                <p className="text-xs text-gray-400">
                  Stock partagé de l’agence.
                </p>

              </div>

              <span className="text-xs font-bold text-gray-500">
                {stocks.length} article(s)
              </span>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>

                  <tr className="text-left text-xs uppercase text-gray-400 border-b">

                    <th className="p-3">
                      Article
                    </th>

                    <th className="p-3 text-center">
                      Quantité
                    </th>

                    <th className="p-3 text-right">
                      Prix pièce
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {stocks.map(stock => (

                    <tr
                      key={stock._id}
                      className="border-b last:border-0"
                    >

                      <td className="p-3 font-semibold text-gray-800">
                        {stock.nom_article}
                      </td>

                      {/* =====================================
                          AFFICHAGE HUMAIN DU STOCK
                          ===================================== */}

                      <td className="p-3 text-center font-black">

                        {formaterStock(stock)}

                      </td>

                      <td className="p-3 text-right">

                        {Number(
                          stock.prix_vente_unite ||
                          stock.prix_vente ||
                          0
                        ).toLocaleString()}{' '}
                        FCFA

                      </td>

                    </tr>

                  ))}

                  {!stocks.length && (

                    <tr>

                      <td
                        colSpan="3"
                        className="p-6 text-center text-gray-400"
                      >
                        Aucun article en stock.
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </section>

        )}

        {/* ===================================================
            JOURNAL / MA CAISSE (Replié par défaut - Accordéon)
            =================================================== */}

        {flags.journal && (

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">

            <div
              onClick={() => setAfficherJournal(prev => !prev)}
              className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/70 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-lg shrink-0 font-bold">
                  📒
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-gray-800">
                      Mon journal / ma caisse
                    </h2>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {activitesDuJour.length} opération{activitesDuJour.length > 1 ? 's' : ''} aujourd'hui
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {afficherJournal
                      ? 'Cliquez pour replier le tableau des opérations de caisse'
                      : 'Tableau masqué par défaut • Cliquez pour afficher le détail'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAfficherJournal(prev => !prev);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    afficherJournal
                      ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      : 'bg-gray-900 text-white shadow-xs hover:bg-gray-800'
                  }`}
                >
                  <span>{afficherJournal ? '🙈 Masquer le tableau' : '👁️ Afficher le tableau'}</span>
                  <span className={`inline-block transition-transform duration-200 ${afficherJournal ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
              </div>
            </div>

            {afficherJournal && (
              <div className="px-5 pb-6 sm:px-6 pt-2 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pt-2">
                  <span className="text-xs text-gray-400 font-medium">
                    Uniquement vos propres opérations enregistrées.
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex p-1 bg-gray-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFiltrePeriode('aujourd_hui')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filtrePeriode === 'aujourd_hui'
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Aujourd'hui ({activitesDuJour.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltrePeriode('tout')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filtrePeriode === 'tout'
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Toutes ({historiqueActivites.length})
                      </button>
                    </div>

                    {loading && (
                      <span className="text-xs text-gray-400">
                        Chargement...
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-left text-xs text-gray-500">
                    <thead className="bg-gray-50 text-gray-700 uppercase">
                      <tr>
                        <th className="p-3">Heure</th>
                        <th className="p-3">Désignation</th>
                        <th className="p-3 text-center">Qté</th>
                        <th className="p-3 text-center">Type</th>
                        <th className="p-3 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {activitesAffichees.map(act => {
                        const estDepense = act.type === 'depense';
                        const estVente = act.type === 'vente';
                        const montant = Number(
                          act.montant_total ??
                          act.montant ??
                          ((Number(act.quantite) || 0) * (Number(act.prix_unitaire) || 0))
                        ) || 0;

                        let affichageQuantite = '-';
                        if (estVente) {
                          affichageQuantite = formaterQuantiteVente(
                            act.quantite,
                            act.option_vente
                          );
                        } else if (!estDepense) {
                          affichageQuantite = act.quantite || 1;
                        }

                        return (
                          <tr key={act._id} className="hover:bg-gray-50/50 transition">
                            <td className="p-3 whitespace-nowrap text-gray-400">
                              {formatHeure(act.createdAt)}
                            </td>
                            <td className="p-3 font-semibold text-gray-800">
                              <div>
                                {act.designation || act.motif || act.description || 'Opération'}
                              </div>
                              {act.longueur != null && act.largeur != null && Number(act.longueur) > 0 && Number(act.largeur) > 0 && (
                                <div className="text-[11px] font-normal text-blue-600 mt-0.5">
                                  📐 {act.longueur}m × {act.largeur}m ({act.surface_m2 || (act.longueur * act.largeur).toFixed(2)} m²)
                                  {act.prix_m2 ? ` à ${Number(act.prix_m2).toLocaleString()} F/m²` : ''}
                                  {act.prix_conception && Number(act.prix_conception) > 0 ? ` • 🎨 Conception: +${Number(act.prix_conception).toLocaleString()} F` : ''}
                                </div>
                              )}
                              {act.prix_conception && Number(act.prix_conception) > 0 && (!act.longueur || !act.largeur) && (
                                <div className="text-[11px] font-semibold text-blue-600 mt-0.5">
                                  🎨 Conception: +{Number(act.prix_conception).toLocaleString()} FCFA
                                </div>
                              )}
                              {act.description && (!act.longueur || !act.largeur) && (
                                <div className="text-[11px] font-normal text-gray-400 mt-0.5">
                                  {act.description}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold">
                              {affichageQuantite}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                estDepense ? 'bg-red-50 text-red-700' : estVente ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {estDepense ? 'Dépense' : act.type}
                              </span>
                            </td>
                            <td className={`p-3 text-right font-black whitespace-nowrap ${
                              estDepense ? 'text-red-600' : 'text-emerald-700'
                            }`}>
                              {estDepense ? '-' : '+'}
                              {masquerChiffres ? '••••••' : `${montant.toLocaleString()} FCFA`}
                            </td>
                          </tr>
                        );
                      })}

                      {!activitesDuJour.length && (
                        <tr>
                          <td colSpan="5" className="p-6 text-center text-gray-400">
                            Aucune opération enregistrée aujourd’hui.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </section>

        )}

        {/* ===================================================
            CRÉDIT / BANQUE
            =================================================== */}

        <CreditBanqueSection />

      </main>

    </div>
  );
}
