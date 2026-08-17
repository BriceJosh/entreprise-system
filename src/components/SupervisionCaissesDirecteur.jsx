import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { formaterQuantiteVente } from '../utils/formatStock';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

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

export default function SupervisionCaissesDirecteur() {
  const [activites, setActivites] = useState([]);

  const [kpis, setKpis] = useState({
    totalVentes: 0,
    totalServices: 0,
    totalEntrees: 0,
    totalDepenses: 0,
    soldeNet: 0,
    nombreOperations: 0,
    secretairesActifs: 0
  });

  const [secretairesInscrits, setSecretairesInscrits] = useState([]);
  const [secretaireFiltre, setSecretaireFiltre] = useState('tous');

  const todayFormatted = new Date().toLocaleDateString('sv-SE');
  const [dateFiltre, setDateFiltre] = useState(todayFormatted);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);

  const chargerSupervisionRef = useRef(null);

  /*
   * =========================================================
   * CHARGEMENT DES SECRÉTAIRES INSCRITS
   * =========================================================
   */

  useEffect(() => {
    const chargerSecretaires = async () => {
      try {
        const token = localStorage.getItem('token');

        const res = await fetch(`${BACKEND_URL}/api/users/secretaires`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setSecretairesInscrits(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(
          'Erreur lors du chargement des secrétaires :',
          err
        );
      }
    };

    chargerSecretaires();
  }, []);

  /*
   * =========================================================
   * SECRÉTAIRES DISPONIBLES (FUSION OFFICIELLE + ACTIVITÉS)
   * =========================================================
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

    activites.forEach((item) => {
      const utilisateur = item?.user_id || item?.vendeur_id || item?.vendeur;
      const identifiant = extractId(utilisateur?._id || utilisateur?.id || utilisateur);
      if (!identifiant) return;

      const dejaConnu = secretaires.has(String(identifiant));
      if (!dejaConnu) {
        secretaires.set(String(identifiant), {
          id: String(identifiant),
          nom:
            utilisateur?.username ||
            utilisateur?.nom ||
            'Secrétariat'
        });
      }
    });

    return [...secretaires.values()].sort((a, b) =>
      a.nom.localeCompare(b.nom, 'fr')
    );
  }, [secretairesInscrits, activites]);

  /*
   * =========================================================
   * CHARGEMENT SUPERVISION
   * =========================================================
   */

  const chargerSupervision = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      const query = new URLSearchParams({
        user_id: secretaireFiltre,
        date: dateFiltre
      });

      const res = await fetch(
        `${BACKEND_URL}/api/caisse/supervision?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        let message = `Erreur serveur (${res.status})`;

        try {
          const errorData = await res.json();

          if (errorData?.message) {
            message = errorData.message;
          }
        } catch {
          // Rien à faire
        }

        throw new Error(message);
      }

      const data = await res.json();

      setActivites(
        Array.isArray(data.activites)
          ? data.activites
          : []
      );

      const kpisRecus = data.kpis || data;

      setKpis({
        totalVentes:
          Number(kpisRecus.totalVentes) || 0,

        totalServices:
          Number(kpisRecus.totalServices) || 0,

        totalEntrees:
          Number(kpisRecus.totalEntrees) || 0,

        totalDepenses:
          Number(kpisRecus.totalDepenses) || 0,

        soldeNet:
          Number(kpisRecus.soldeNet ?? kpisRecus.solde) || 0,

        nombreOperations:
          Number(kpisRecus.nombreOperations) || 0,

        secretairesActifs:
          Number(kpisRecus.secretairesActifs) || 0
      });
    } catch (err) {
      console.error(
        'Erreur chargement supervision :',
        err
      );

      setError(
        err.message ||
          'Impossible de charger la supervision.'
      );
    } finally {
      setLoading(false);
    }
  }, [secretaireFiltre, dateFiltre]);

  useEffect(() => {
    chargerSupervisionRef.current = chargerSupervision;
  }, [chargerSupervision]);

  useEffect(() => {
    let ignore = false;

    const fetchSupervision = async () => {
      try {
        const token = localStorage.getItem('token');

        const query = new URLSearchParams({
          user_id: secretaireFiltre,
          date: dateFiltre
        });

        const res = await fetch(
          `${BACKEND_URL}/api/caisse/supervision?${query.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!res.ok) {
          let message = `Erreur serveur (${res.status})`;

          try {
            const errorData = await res.json();

            if (errorData?.message) {
              message = errorData.message;
            }
          } catch {
            // Rien à faire
          }

          throw new Error(message);
        }

        const data = await res.json();

        if (!ignore) {
          setActivites(
            Array.isArray(data.activites)
              ? data.activites
              : []
          );

          const kpisRecus = data.kpis || data;

          setKpis({
            totalVentes:
              Number(kpisRecus.totalVentes) || 0,

            totalServices:
              Number(kpisRecus.totalServices) || 0,

            totalEntrees:
              Number(kpisRecus.totalEntrees) || 0,

            totalDepenses:
              Number(kpisRecus.totalDepenses) || 0,

            soldeNet:
              Number(kpisRecus.soldeNet ?? kpisRecus.solde) || 0,

            nombreOperations:
              Number(kpisRecus.nombreOperations) || 0,

            secretairesActifs:
              Number(kpisRecus.secretairesActifs) || 0
          });

          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error(
            'Erreur chargement supervision :',
            err
          );

          setError(
            err.message ||
              'Impossible de charger la supervision.'
          );
          setLoading(false);
        }
      }
    };

    fetchSupervision();

    return () => {
      ignore = true;
    };
  }, [secretaireFiltre, dateFiltre]);

  /*
   * =========================================================
   * TEMPS RÉEL SOCKET.IO
   * =========================================================
   */

  useEffect(() => {
    const token = localStorage.getItem('token');

    const socket = io(BACKEND_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log(
        'Socket supervision connecté :',
        socket.id
      );
    });

    socket.on('connect_error', (err) => {
      console.warn(
        'Erreur Socket.IO supervision :',
        err.message
      );
    });

    const events = [
      'vente:nouvelle',
      'activite_ajoutee',
      'depense_ajoutee',
      'impression:nouvelle',
      'depot_banque_ajoute',
      'credit_ajoute',
      'credit_paiement_ajoute',
      'credit_mis_a_jour'
    ];

    const handleRealtimeUpdate = () => {
      if (chargerSupervisionRef.current) {
        chargerSupervisionRef.current();
      }
    };

    events.forEach((event) => {
      socket.on(event, handleRealtimeUpdate);
    });

    return () => {
      events.forEach((event) => {
        socket.off(event, handleRealtimeUpdate);
      });

      socket.disconnect();
    };
  }, []);

  /*
   * =========================================================
   * FORMATAGE
   * =========================================================
   */

  const formatHeure = (date) => {
    if (!date) {
      return '-';
    }

    try {
      return new Date(date).toLocaleTimeString(
        'fr-FR',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      );
    } catch {
      return '-';
    }
  };

  const formatMontant = (montant) => {
    return (
      Number(montant) || 0
    ).toLocaleString('fr-FR');
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'vente':
        return 'Vente';

      case 'impression':
        return 'Service';

      case 'depense':
        return 'Dépense';

      case 'depot':
        return 'Dépôt';

      case 'credit':
        return 'Crédit';

      case 'paiement_credit':
        return 'Paiement crédit';

      default:
        return type || 'Autre';
    }
  };

  const getTypeClasses = (type) => {
    switch (type) {
      case 'vente':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';

      case 'impression':
        return 'bg-blue-50 text-blue-700 border-blue-200';

      case 'depense':
        return 'bg-red-50 text-red-700 border-red-200';

      case 'depot':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';

      case 'credit':
        return 'bg-amber-50 text-amber-700 border-amber-200';

      case 'paiement_credit':
        return 'bg-purple-50 text-purple-700 border-purple-200';

      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getMontantClasses = (type) => {
    if (type === 'depense' || type === 'paiement_credit') {
      return 'text-red-600';
    }

    return 'text-emerald-700';
  };

  /*
   * =========================================================
   * EXPORT
   * =========================================================
   */

  const telechargerExport = async (format) => {
    setExportingFormat(format);

    try {
      const token = localStorage.getItem('token');

      const query = new URLSearchParams({
        user_id: secretaireFiltre,
        date: dateFiltre
      });

      const response = await fetch(
        `${BACKEND_URL}/api/caisse/export/${format}?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        let message =
          'Erreur lors de la génération du fichier.';

        try {
          const data = await response.json();

          if (data?.message) {
            message = data.message;
          }
        } catch {
          // Rien à faire
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const url =
        window.URL.createObjectURL(blob);

      const a =
        document.createElement('a');

      a.href = url;

      a.download =
        `Rapport_Supervision_${
          secretaireFiltre !== 'tous'
            ? secretaireFiltre
            : 'toutes_caisses'
        }_${dateFiltre}.${
          format === 'excel'
            ? 'xlsx'
            : 'pdf'
        }`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        'Erreur export :',
        err
      );

      alert(
        err.message ||
          "Impossible d'exporter le fichier."
      );
    } finally {
      setExportingFormat(null);
    }
  };

  /*
   * =========================================================
   * RENDU
   * =========================================================
   */

  return (
    <div className="space-y-6">

      {/* =====================================================
          EN-TÊTE
      ===================================================== */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">

        <div>
          <h2 className="text-xl font-black text-gray-800">
            Supervision des Caisses
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            Suivi en direct des ventes, services et dépenses
            par agent et par site
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <select
            value={secretaireFiltre}
            onChange={(e) =>
              setSecretaireFiltre(e.target.value)
            }
            className="p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="tous">
              Toutes les caisses / agents
            </option>

            {secretairesDisponibles.map((sec) => (
              <option
                key={sec.id}
                value={sec.id}
              >
                {sec.nom}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFiltre}
            onChange={(e) =>
              setDateFiltre(e.target.value)
            }
            className="p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
          />

          <button
            onClick={chargerSupervision}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            {loading
              ? 'Chargement...'
              : 'Rafraîchir'}
          </button>

        </div>
      </div>

      {/* =====================================================
          KPI
      ===================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* VENTES */}

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">

          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Ventes
          </span>

          <p className="text-2xl font-black text-emerald-700 mt-2">
            {formatMontant(kpis.totalVentes)}

            <span className="text-xs font-bold ml-1">
              FCFA
            </span>
          </p>

        </div>

        {/* SERVICES */}

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">

          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Services
          </span>

          <p className="text-2xl font-black text-blue-700 mt-2">
            {formatMontant(kpis.totalServices)}

            <span className="text-xs font-bold ml-1">
              FCFA
            </span>
          </p>

        </div>

        {/* DEPENSES */}

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">

          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Dépenses
          </span>

          <p className="text-2xl font-black text-red-600 mt-2">
            {formatMontant(kpis.totalDepenses)}

            <span className="text-xs font-bold ml-1">
              FCFA
            </span>
          </p>

        </div>

        {/* SOLDE */}

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">

          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Solde net
          </span>

          <p
            className={`text-2xl font-black mt-2 ${
              kpis.soldeNet >= 0
                ? 'text-emerald-700'
                : 'text-red-600'
            }`}
          >
            {formatMontant(kpis.soldeNet)}

            <span className="text-xs font-bold ml-1">
              FCFA
            </span>
          </p>

        </div>

      </div>

      {/* =====================================================
          KPI SECONDAIRES
      ===================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">

          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Nombre d'opérations
          </span>

          <p className="text-2xl font-black text-gray-800 mt-2">
            {kpis.nombreOperations}

            <span className="text-xs text-gray-400 font-normal ml-1">
              opération(s)
            </span>
          </p>

        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">

          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Agents actifs
          </span>

          <p className="text-2xl font-black text-blue-700 mt-2">
            {kpis.secretairesActifs}

            <span className="text-xs text-gray-400 font-normal ml-1">
              agent(s)
            </span>
          </p>

        </div>

      </div>

      {/* =====================================================
          ERREUR
      ===================================================== */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold flex justify-between items-center">

          <span>
            {error}
          </span>

          <button
            onClick={chargerSupervision}
            className="underline uppercase cursor-pointer"
          >
            Réessayer
          </button>

        </div>
      )}

      {/* =====================================================
          TABLEAU
      ===================================================== */}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-2">

          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Détail des opérations ({activites.length})
          </h3>

          <span className="text-xs text-gray-400 font-medium">
            Filtre appliqué : {dateFiltre}
          </span>

        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm font-medium">
            Chargement des données de supervision...
          </div>
        ) : activites.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm font-medium">
            Aucune opération enregistrée pour cette date.
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs border-collapse">

              <thead>

                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-bold">

                  <th className="p-4">
                    Heure
                  </th>

                  <th className="p-4">
                    Type
                  </th>

                  <th className="p-4">
                    Agent
                  </th>

                  <th className="p-4">
                    Site
                  </th>

                  <th className="p-4">
                    Désignation
                  </th>

                  <th className="p-4 text-center">
                    Quantité
                  </th>

                  <th className="p-4 text-right">
                    Prix unitaire
                  </th>

                  <th className="p-4 text-right">
                    Montant
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-gray-100 font-medium">

                {activites.map((activite) => {

                  const agentNom =
                    activite.user_id?.username ||
                    activite.user_id?.nom ||
                    'Agent';

                  const siteNom =
                    activite.site_id?.nom ||
                    'Site principal';

                  const montant =
                    Number(activite.montant_total) || 0;

                  const quantite =
                    activite.quantite === null ||
                    activite.quantite === undefined
                      ? null
                      : Number(activite.quantite) || 0;

                  const quantiteAffichee =
                    activite.type === 'vente'
                      ? formaterQuantiteVente(
                          quantite || 0,
                          activite.option_vente
                        )
                      : quantite ?? '-';

                  const prixUnitaire =
                    activite.prix_unitaire === null ||
                    activite.prix_unitaire === undefined
                      ? null
                      : Number(activite.prix_unitaire) || 0;

                  return (
                    <tr
                      key={activite._id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >

                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {formatHeure(
                          activite.createdAt
                        )}
                      </td>

                      <td className="p-4">

                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${getTypeClasses(
                            activite.type
                          )}`}
                        >
                          {getTypeLabel(
                            activite.type
                          )}
                        </span>

                      </td>

                      <td className="p-4 font-bold text-gray-800">
                        {agentNom}
                      </td>

                      <td className="p-4 text-gray-600">
                        {siteNom}
                      </td>

                      <td className="p-4 text-gray-700">

                        <div className="font-semibold">
                          {activite.designation ||
                            activite.description ||
                            'Opération'}
                        </div>

                        {activite.type !== 'depense' &&
                          activite.option_vente && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {activite.option_vente}
                            </div>
                          )}

                      </td>

                      <td className="p-4 text-center text-gray-600">
                        {quantiteAffichee}
                      </td>

                      <td className="p-4 text-right text-gray-600 whitespace-nowrap">
                        {prixUnitaire === null
                          ? '-'
                          : `${formatMontant(prixUnitaire)} FCFA`}
                      </td>

                      <td
                        className={`p-4 text-right font-black whitespace-nowrap ${getMontantClasses(
                          activite.type
                        )}`}
                      >
                        {(activite.type === 'depense' ||
                          activite.type === 'paiement_credit') && '- '}

                        {formatMontant(
                          montant
                        )}{' '}
                        FCFA
                      </td>

                    </tr>
                  );
                })}

              </tbody>

              <tfoot className="bg-gray-100/80 border-t-2 border-gray-200">

                <tr>

                  <td
                    colSpan="7"
                    className="p-4 uppercase tracking-wider text-right font-black text-gray-800"
                  >
                    Solde net :
                  </td>

                  <td
                    className={`p-4 text-right font-black ${
                      kpis.soldeNet >= 0
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {formatMontant(
                      kpis.soldeNet
                    )}{' '}
                    FCFA
                  </td>

                </tr>

              </tfoot>

            </table>

          </div>
        )}

      </div>

      {/* =====================================================
          EXPORTS
      ===================================================== */}

      <div className="flex flex-wrap items-center gap-3 pt-2">

        <button
          onClick={() =>
            telechargerExport('excel')
          }
          disabled={
            exportingFormat !== null ||
            activites.length === 0
          }
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          {exportingFormat === 'excel'
            ? 'Génération Excel...'
            : 'Export Excel'}
        </button>

        <button
          onClick={() =>
            telechargerExport('pdf')
          }
          disabled={
            exportingFormat !== null ||
            activites.length === 0
          }
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
        >
          {exportingFormat === 'pdf'
            ? 'Génération PDF...'
            : 'Export PDF'}
        </button>

      </div>

    </div>
  );
}
