import { useState, useEffect, useMemo } from "react";
import io from "socket.io-client";
import { Link } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import InstallPwaButton from "../components/InstallPwaButton";
import SupervisionCaissesDirecteur from "../components/SupervisionCaissesDirecteur";
import { formaterQuantiteVente, formaterStock } from "../utils/formatStock";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Transforme n'importe quelle représentation d'un ID
 * MongoDB en chaîne comparable.
 */
const extractId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
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

/**
 * Supprime les doublons ayant le même identifiant.
 */
const dedoublonnerParId = (liste) => {
  if (!Array.isArray(liste)) {
    return [];
  }

  const dejaVus = new Set();

  return liste.filter((item) => {
    const id = extractId(item?._id);

    if (id) {
      if (dejaVus.has(id)) {
        return false;
      }

      dejaVus.add(id);
      return true;
    }

    return true;
  });
};

const obtenirIdSite = (item) => {
  if (!item) return null;

  const candidats = [
    item.site_id,
    item.siteId,
    item.site,
    item.agence_id,
    item.agenceId,
    item.agence,
  ];

  for (const candidat of candidats) {
    const id = extractId(candidat);

    if (id) {
      return id;
    }
  }

  return null;
};

const getMontantAbsolu = (item) => {
  if (!item) return 0;

  let valeur =
    item.montant_total ??
    item.montant ??
    item.prix ??
    item.somme ??
    item.valeur;

  if (valeur === undefined || valeur === null) {
    const quantite = Number(item.quantite ?? 1);
    const prixUnitaire = Number(item.prix_unitaire ?? 0);

    valeur = quantite * prixUnitaire;
  }

  const montant = Number(valeur);

  if (!Number.isFinite(montant)) {
    return 0;
  }

  return Math.abs(montant);
};

const obtenirDateItem = (item) => {
  if (!item) {
    return null;
  }

  const dateBrute = item.createdAt || item.date || item.updatedAt || null;

  if (!dateBrute) {
    return null;
  }

  const date = new Date(dateBrute);

  return Number.isNaN(date.getTime()) ? null : date;
};

export default function DashboardDirecteur({ profil }) {
  const [ongletActif, setOngletActif] = useState("vue_globale");

  // "tous" = tous les sites
  const [siteSelectionne, setSiteSelectionne] = useState("tous");

  // Les caisses sont personnelles : ce filtre utilise user_id, sans
  // modifier le stock partagé au niveau du site.
  const [secretaireSelectionnee, setSecretaireSelectionnee] = useState("tous");

  const [periodeFiltre, setPeriodeFiltre] = useState("mois");

  const [sites, setSites] = useState([]);
  const [fluxActivites, setFluxActivites] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [inventaireStocks, setInventaireStocks] = useState([]);

  /*
   * Liste officielle des comptes secrétaires (API
   * /api/users/secretaires). Permet d'afficher une secrétaire
   * dans le filtre même si elle n'a encore aucune activité.
   */
  const [secretairesInscrits, setSecretairesInscrits] = useState([]);
  const [errorLoading, setErrorLoading] = useState(null);

  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem("token")),
  );

  const token = localStorage.getItem("token");

  /**
   * Retourne le nom du site correspondant à une valeur.
   */
  const obtenirNomSite = (siteFieldValue) => {
    const idPropre = extractId(siteFieldValue);

    if (!idPropre) {
      return "Site inconnu";
    }

    /**
     * Si le site est déjà populé.
     */
    if (
      typeof siteFieldValue === "object" &&
      siteFieldValue !== null &&
      siteFieldValue.nom
    ) {
      return siteFieldValue.nom;
    }

    /**
     * Sinon recherche dans la liste des sites.
     */
    const siteTrouve = sites.find((site) => extractId(site._id) === idPropre);

    return siteTrouve?.nom || "Site inconnu";
  };

  /**
   * ============================================================
   * CHARGEMENT DES DONNÉES
   * ============================================================
   */

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = io(BACKEND_URL, {
      auth: {
        token,
      },
    });

    async function chargerDonnees() {
      try {
        setLoading(true);
        setErrorLoading(null);

        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        const [resSites, resActivites, resStocks, resDepenses, resSecretaires] =
          await Promise.all([
            fetch(`${BACKEND_URL}/api/sites`, {
              headers,
            }),

            fetch(`${BACKEND_URL}/api/activites`, {
              headers,
            }),

            fetch(`${BACKEND_URL}/api/stocks`, {
              headers,
            }),

            fetch(`${BACKEND_URL}/api/depenses`, {
              headers,
            }),

            fetch(`${BACKEND_URL}/api/users/secretaires`, {
              headers,
            }),
          ]);

        /**
         * Vérification des réponses HTTP.
         */
        if (!resSites.ok) {
          throw new Error(`Erreur API sites : ${resSites.status}`);
        }

        if (!resActivites.ok) {
          throw new Error(`Erreur API activités : ${resActivites.status}`);
        }

        if (!resStocks.ok) {
          throw new Error(`Erreur API stocks : ${resStocks.status}`);
        }

        if (!resDepenses.ok) {
          throw new Error(`Erreur API dépenses : ${resDepenses.status}`);
        }

        /*
         * La liste des secrétaires peut échouer sur un ancien
         * backend sans cette route : on ne bloque pas le reste
         * du tableau de bord dans ce cas.
         */
        if (!resSecretaires.ok) {
          console.warn(
            `API secrétaires indisponible : ${resSecretaires.status}`,
          );
        }

        const [
          dataSites,
          dataActivites,
          dataStocks,
          dataDepenses,
          dataSecretaires,
        ] = await Promise.all([
          resSites.json(),
          resActivites.json(),
          resStocks.json(),
          resDepenses.json(),
          resSecretaires.ok ? resSecretaires.json() : [],
        ]);

        /**
         * Gestion des différents formats possibles des API.
         */
        const listeSites = Array.isArray(dataSites)
          ? dataSites
          : Array.isArray(dataSites?.sites)
            ? dataSites.sites
            : [];

        const listeActivitesBrutes = Array.isArray(dataActivites)
          ? dataActivites
          : Array.isArray(dataActivites?.activites)
            ? dataActivites.activites
            : [];

        const listeStocks = Array.isArray(dataStocks)
          ? dataStocks
          : Array.isArray(dataStocks?.stocks)
            ? dataStocks.stocks
            : [];

        const listeDepensesBrutes = Array.isArray(dataDepenses)
          ? dataDepenses
          : Array.isArray(dataDepenses?.depenses)
            ? dataDepenses.depenses
            : [];

        const listeSecretaires = Array.isArray(dataSecretaires)
          ? dataSecretaires
          : [];

        /**
         * ========================================================
         * IMPORTANT :
         *
         * Une dépense peut être présente à la fois :
         *
         * - dans /api/activites
         * - dans /api/depenses
         *
         * On retire donc les activités de type "depense"
         * de la liste des activités.
         *
         * Les dépenses officielles restent dans /api/depenses.
         * ========================================================
         */

        const activitesSansDepenses = listeActivitesBrutes.filter(
          (activite) =>
            String(activite?.type || "").toLowerCase() !== "depense",
        );

        /**
         * Déduplication supplémentaire par _id.
         */
        const listeActivites = dedoublonnerParId(activitesSansDepenses);

        const listeDepenses = dedoublonnerParId(listeDepensesBrutes);

        const listeStocksUniques = dedoublonnerParId(listeStocks);

        const listeSitesUniques = dedoublonnerParId(listeSites);

        setSites(listeSitesUniques);
        setFluxActivites(listeActivites);
        setInventaireStocks(listeStocksUniques);
        setDepenses(listeDepenses);
        setSecretairesInscrits(listeSecretaires);

        /**
         * Console de diagnostic.
         */
        console.log("=== DASHBOARD DIRECTEUR ===");

        console.log("Sites chargés :", listeSitesUniques);

        console.log("Activités chargées :", listeActivites);

        console.log("Dépenses chargées :", listeDepenses);

        console.log("Stocks chargés :", listeStocksUniques);

        console.log("Secrétaires chargés :", listeSecretaires);

        console.log("Nombre activités :", listeActivites.length);

        console.log("Nombre dépenses :", listeDepenses.length);
      } catch (error) {
        console.error(
          "Erreur lors du chargement des données directeur :",
          error,
        );
        setErrorLoading(
          "Impossible de charger les données. Veuillez vérifier la connexion au serveur et à la base de données."
        );
      } finally {
        setLoading(false);
      }
    }

    chargerDonnees();

    /**
     * ============================================================
     * SOCKET ACTIVITÉS
     * ============================================================
     */

    socket.on("activite_ajoutee", (nouvelleActivite) => {
      /**
       * Une activité de type "depense" est volontairement
       * ignorée ici car elle est gérée par depense_ajoutee.
       */
      if (String(nouvelleActivite?.type || "").toLowerCase() === "depense") {
        return;
      }

      setFluxActivites((prev) => {
        const idNouvelle = extractId(nouvelleActivite?._id);

        /**
         * Protection contre le doublon Socket.io.
         */
        if (idNouvelle) {
          const existeDeja = prev.some(
            (activite) => extractId(activite?._id) === idNouvelle,
          );

          if (existeDeja) {
            return prev;
          }
        }

        return dedoublonnerParId([nouvelleActivite, ...prev]);
      });
    });

    socket.on("activite_modifiee", ({ _id, updatedFields }) => {
      setFluxActivites((prev) =>
        prev.map((activite) =>
          extractId(activite?._id) === extractId(_id)
            ? {
                ...activite,
                ...updatedFields,
              }
            : activite,
        ),
      );
    });

    socket.on("activite_supprimee", (idSupprime) => {
      setFluxActivites((prev) =>
        prev.filter(
          (activite) => extractId(activite?._id) !== extractId(idSupprime),
        ),
      );
    });

    /**
     * ============================================================
     * SOCKET DÉPENSES
     * ============================================================
     */

    socket.on("depense_ajoutee", (nouvelleDepense) => {
      setDepenses((prev) => {
        const idNouvelle = extractId(nouvelleDepense?._id);

        /**
         * Protection principale contre le doublon.
         */
        if (idNouvelle) {
          const existeDeja = prev.some(
            (depense) => extractId(depense?._id) === idNouvelle,
          );

          if (existeDeja) {
            return prev;
          }
        }

        return dedoublonnerParId([nouvelleDepense, ...prev]);
      });
    });

    socket.on("depense_modifiee", ({ _id, updatedFields }) => {
      setDepenses((prev) =>
        prev.map((depense) =>
          extractId(depense?._id) === extractId(_id)
            ? {
                ...depense,
                ...updatedFields,
              }
            : depense,
        ),
      );
    });

    socket.on("depense_supprimee", (idSupprime) => {
      setDepenses((prev) =>
        prev.filter(
          (depense) => extractId(depense?._id) !== extractId(idSupprime),
        ),
      );
    });

    /**
     * Nettoyage Socket.io.
     */
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token]);

  /**
   * ============================================================
   * SECRÉTAIRES DISPONIBLES POUR LE FILTRE
   * ============================================================
   *
   * Fusion de deux sources :
   *
   * 1. La liste officielle des comptes secrétaires renvoyée
   *    par l'API /api/users/secretaires.
   *
   * 2. Les secrétaires détectées dans les activités et dépenses
   *    chargées (au cas où l'API ne serait pas disponible).
   *
   * Chaque entrée possède : id, nom, siteId.
   */

  const secretairesDisponibles = useMemo(() => {
    const secretaires = new Map();

    /*
     * Source 1 : comptes officiels.
     */
    secretairesInscrits.forEach((secretaire) => {
      const identifiant = extractId(secretaire._id || secretaire.id);

      if (!identifiant) return;

      secretaires.set(String(identifiant), {
        id: String(identifiant),
        nom: secretaire.username || secretaire.nom || "Secrétariat",
        siteId: obtenirIdSite(secretaire),
      });
    });

    /*
     * Source 2 : activités et dépenses.
     */
    [...fluxActivites, ...depenses].forEach((item) => {
      const utilisateur = item?.user_id || item?.vendeur_id || item?.vendeur;
      const identifiant = extractId(utilisateur);

      if (!identifiant) return;

      const dejaConnu = secretaires.has(String(identifiant));

      if (!dejaConnu) {
        secretaires.set(String(identifiant), {
          id: String(identifiant),
          nom: utilisateur?.username || utilisateur?.nom || "Secrétariat",
          siteId: obtenirIdSite(item),
        });
      } else {
        /*
         * Si le compte officiel n'avait pas de site
         * mais que l'activité en a un, on le complète.
         */
        const existant = secretaires.get(String(identifiant));

        if (!existant.siteId) {
          const siteDepuisActivite = obtenirIdSite(item);

          if (siteDepuisActivite) {
            secretaires.set(String(identifiant), {
              ...existant,
              siteId: siteDepuisActivite,
            });
          }
        }
      }
    });

    return [...secretaires.values()].sort((a, b) =>
      a.nom.localeCompare(b.nom, "fr"),
    );
  }, [secretairesInscrits, fluxActivites, depenses]);

  /**
   * Secrétaires affichées dans le menu déroulant :
   * filtrées selon l'agence sélectionnée.
   */
  const secretairesFiltresParSite = useMemo(() => {
    if (siteSelectionne === "tous") {
      return secretairesDisponibles;
    }

    return secretairesDisponibles.filter(
      (secretaire) => secretaire.siteId === String(siteSelectionne),
    );
  }, [secretairesDisponibles, siteSelectionne]);

  /**
   * Quand l'agence change, si la secrétaire sélectionnée
   * n'appartient plus à cette agence, on revient à "tous".
   */
  const gererChangementSite = (nouvelleValeur) => {
    setSiteSelectionne(nouvelleValeur);

    if (secretaireSelectionnee === "tous") {
      return;
    }

    if (nouvelleValeur === "tous") {
      return;
    }

    const toujoursValide = secretairesDisponibles.some(
      (secretaire) =>
        secretaire.id === secretaireSelectionnee &&
        secretaire.siteId === String(nouvelleValeur),
    );

    if (!toujoursValide) {
      setSecretaireSelectionnee("tous");
    }
  };

  /**
   * ============================================================
   * FILTRAGE GLOBAL
   * ============================================================
   */

  const { fluxFiltre, stocksFiltres } = useMemo(() => {
    const maintenant = new Date();

    /**
     * Début de la période sélectionnée.
     */
    const debutPeriode = new Date(maintenant);

    if (periodeFiltre === "jour") {
      debutPeriode.setHours(0, 0, 0, 0);
    }

    if (periodeFiltre === "semaine") {
      debutPeriode.setDate(maintenant.getDate() - 7);
      debutPeriode.setHours(0, 0, 0, 0);
    }

    if (periodeFiltre === "mois") {
      debutPeriode.setDate(1);
      debutPeriode.setHours(0, 0, 0, 0);
    }

    if (periodeFiltre === "annee") {
      debutPeriode.setMonth(0, 1);
      debutPeriode.setHours(0, 0, 0, 0);
    }

    /**
     * ==========================================================
     * ACTIVITÉS
     * ==========================================================
     */

    const activitesFormatees = fluxActivites
      /**
       * Sécurité supplémentaire :
       * aucune activité de type "depense" ne passe ici.
       */
      .filter((item) => String(item?.type || "").toLowerCase() !== "depense")
      .map((item) => {
        const dateItem = obtenirDateItem(item);

        return {
          ...item,

          isDepense: false,

          montantCalcule: getMontantAbsolu(item),

          dateTri: dateItem,
        };
      });

    /**
     * ==========================================================
     * DÉPENSES
     * ==========================================================
     */

    const depensesFormatees = depenses.map((item) => {
      const dateItem = obtenirDateItem(item);

      return {
        ...item,

        isDepense: true,

        montantCalcule: getMontantAbsolu(item),

        dateTri: dateItem,
      };
    });

    /**
     * ==========================================================
     * FUSION
     * ==========================================================
     *
     * Ici, une dépense n'existe PLUS dans activitesFormatees.
     *
     * Donc :
     *
     * activité normale = 1 ligne
     * dépense = 1 ligne
     *
     * et jamais :
     *
     * activité + dépense = 2 lignes.
     * ==========================================================
     */

    const fluxGlobal = [...activitesFormatees, ...depensesFormatees];

    /**
     * Déduplication finale de sécurité.
     *
     * Cela protège également contre un éventuel doublon
     * arrivé depuis le backend ou Socket.io.
     */
    const fluxGlobalUnique = dedoublonnerParId(fluxGlobal);

    /**
     * ==========================================================
     * FILTRE SITE + SECRÉTAIRE + PÉRIODE
     * ==========================================================
     */

    const itemsFiltres = fluxGlobalUnique.filter((item) => {
      /**
       * ------------------------------------------------------
       * FILTRE SITE
       * ------------------------------------------------------
       */

      let matchSite = true;

      if (siteSelectionne !== "tous") {
        const idSiteItem = obtenirIdSite(item);

        matchSite =
          idSiteItem !== null && idSiteItem === String(siteSelectionne);
      }

      /*
       * Les activités et dépenses possèdent chacune un user_id.
       * Deux secrétaires d'un même site partagent donc le stock,
       * mais restent séparées dans leur caisse et leur journal.
       */
      const auteurId = extractId(
        item.user_id || item.vendeur_id || item.vendeur,
      );

      const matchSecretaire =
        secretaireSelectionnee === "tous" ||
        (auteurId !== null && auteurId === String(secretaireSelectionnee));

      /**
       * ------------------------------------------------------
       * FILTRE PÉRIODE
       * ------------------------------------------------------
       */

      let matchPeriode;

      const dateItem = item.dateTri;

      if (dateItem) {
        if (periodeFiltre === "jour") {
          matchPeriode = dateItem.toDateString() === maintenant.toDateString();
        } else {
          matchPeriode = dateItem >= debutPeriode && dateItem <= maintenant;
        }
      } else {
        matchPeriode = false;
      }

      return matchSite && matchSecretaire && matchPeriode;
    });

    /**
     * Plus récent en premier.
     */
    itemsFiltres.sort((a, b) => {
      const dateA = a.dateTri ? a.dateTri.getTime() : 0;

      const dateB = b.dateTri ? b.dateTri.getTime() : 0;

      return dateB - dateA;
    });

    /**
     * ==========================================================
     * FILTRE STOCK
     * ==========================================================
     */

    const stocksFiltres = inventaireStocks.filter((stock) => {
      if (siteSelectionne === "tous") {
        return true;
      }

      const idSiteStock = obtenirIdSite(stock);

      return idSiteStock !== null && idSiteStock === String(siteSelectionne);
    });

    return {
      fluxFiltre: itemsFiltres,
      stocksFiltres,
    };
  }, [
    fluxActivites,
    depenses,
    inventaireStocks,
    siteSelectionne,
    secretaireSelectionnee,
    periodeFiltre,
  ]);

  /**
   * ============================================================
   * CALCUL DES KPI
   * ============================================================
   */

  const totalRecettes = useMemo(() => {
    return fluxFiltre
      .filter((item) => !item.isDepense)
      .reduce((total, item) => total + item.montantCalcule, 0);
  }, [fluxFiltre]);

  const totalDepenses = useMemo(() => {
    return fluxFiltre
      .filter((item) => item.isDepense)
      .reduce((total, item) => total + item.montantCalcule, 0);
  }, [fluxFiltre]);

  const beneficeNet = totalRecettes - totalDepenses;

  /**
   * ============================================================
   * ALERTES STOCK
   * ============================================================
   */

  const nombreAlertesStock = useMemo(() => {
    return stocksFiltres.filter((item) => {
      const quantite = Number(item.quantite) || 0;

      const seuil =
        item.seuil_alerte !== undefined && item.seuil_alerte !== null
          ? Number(item.seuil_alerte)
          : 5;

      return quantite <= seuil;
    }).length;
  }, [stocksFiltres]);

  /**
   * ============================================================
   * FORMATAGE DATE
   * ============================================================
   */

  const formatDateEtHeure = (isoDate) => {
    if (!isoDate) {
      return "--/-- --:--";
    }

    const d = new Date(isoDate);

    if (Number.isNaN(d.getTime())) {
      return "--/-- --:--";
    }

    return `${d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    })} à ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  /**
   * ============================================================
   * CHARGEMENT
   * ============================================================
   */

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  /**
   * ============================================================
   * INTERFACE
   * ============================================================
   */

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* BANNÈRE D'ERREUR DE CHARGEMENT */}
      {errorLoading && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <p className="text-sm font-semibold text-red-700">{errorLoading}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ======================================================
          EN-TÊTE
      ====================================================== */}

      <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <img
            src="/Logo.jpeg"
            alt="Logo Entreprise"
            className="w-12 h-12 rounded-xl object-contain border border-gray-100 p-0.5"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div>
            <span className="bg-purple-50 text-purple-600 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full">
              Supervision Direction
            </span>

            <h1 className="text-2xl font-black text-gray-800 mt-1">
              Tableau de Bord Global
            </h1>

            <p className="text-sm text-gray-500">
              Connecté en tant que{" "}
              <span className="font-semibold text-gray-700">
                {profil?.username || "Direction Générale"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:items-end gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <InstallPwaButton role="directeur" />
            <InstallPwaButton role="directeur" mobileOnly={true} />

            <Link
              to="/historique"
              className="bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold py-2 px-4 rounded-xl text-xs uppercase"
            >
              Historique
            </Link>

            <Link
              to="/profil"
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold py-2 px-4 rounded-xl text-xs uppercase"
            >
              Profil
            </Link>

            <LogoutButton />
          </div>

          {/* ==================================================
              FILTRES
          ================================================== */}

          <div className="flex flex-wrap items-center gap-3">
            {/* FILTRE SITE */}

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Filtrer par Agence
              </label>

              <select
                value={siteSelectionne}
                onChange={(e) => gererChangementSite(e.target.value)}
                className="p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="tous">📍 Tous les sites d'implantation</option>

                {sites.map((site) => {
                  const siteId = extractId(site._id);

                  return (
                    <option key={siteId} value={siteId}>
                      {site.nom}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* FILTRE SECRÉTAIRE / CAISSE */}

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Filtrer par secrétaire
              </label>

              <select
                value={secretaireSelectionnee}
                onChange={(e) => setSecretaireSelectionnee(e.target.value)}
                className="p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="tous">Toutes les caisses</option>

                {secretairesFiltresParSite.map((secretaire) => (
                  <option key={secretaire.id} value={secretaire.id}>
                    {secretaire.nom}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTRE PÉRIODE */}

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                Période des Comptes
              </label>

              <select
                value={periodeFiltre}
                onChange={(e) => setPeriodeFiltre(e.target.value)}
                className="p-2.5 border rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="jour">Aujourd'hui</option>

                <option value="semaine">Cette semaine</option>

                <option value="mois">Ce Mois</option>

                <option value="annee">Année en cours</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================
          ONGLETS
      ====================================================== */}

      <div className="flex bg-gray-200/60 p-1.5 rounded-2xl w-fit gap-2 font-bold text-xs">
        <button
          onClick={() => setOngletActif("vue_globale")}
          className={`px-5 py-2.5 rounded-xl transition-all ${
            ongletActif === "vue_globale"
              ? "bg-white text-purple-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Vue Globale & Flux
        </button>

        <button
          onClick={() => setOngletActif("supervision_caisses")}
          className={`px-5 py-2.5 rounded-xl transition-all ${
            ongletActif === "supervision_caisses"
              ? "bg-white text-purple-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Supervision des Caisses
        </button>
      </div>

      {/* ======================================================
          SUPERVISION CAISSES
      ====================================================== */}

      {ongletActif === "supervision_caisses" ? (
        <SupervisionCaissesDirecteur />
      ) : (
        <>
          {/* ==================================================
              KPI
          ================================================== */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CHIFFRE D'AFFAIRES */}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-600">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Chiffre d'Affaires
              </p>

              <p className="text-2xl font-black text-gray-800 mt-2">
                {totalRecettes.toLocaleString("fr-FR")} FCFA
              </p>
            </div>

            {/* DEPENSES */}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-red-500">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Dépenses Globales
              </p>

              <p className="text-2xl font-black text-gray-800 mt-2">
                {totalDepenses.toLocaleString("fr-FR")} FCFA
              </p>
            </div>

            {/* BENEFICE */}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-600">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Bénéfice Net Estimé
              </p>

              <p
                className={`text-2xl font-black mt-2 ${
                  beneficeNet >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {beneficeNet.toLocaleString("fr-FR")} FCFA
              </p>
            </div>

            {/* ALERTES STOCK */}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-orange-500">
              <p className="text-xs font-bold text-gray-400 uppercase">
                Alertes de Stocks
              </p>

              <p className="text-2xl font-black text-gray-800 mt-2">
                {nombreAlertesStock} Article(s)
              </p>
            </div>
          </div>

          {/* ==================================================
              FLUX ACTIVITÉS / DÉPENSES
          ================================================== */}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-4">
              Flux d'activités et Dépenses
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-500">
                <thead className="bg-gray-50 text-gray-700 uppercase">
                  <tr>
                    <th className="p-3">Date & Heure</th>

                    <th className="p-3">Emplacement</th>

                    <th className="p-3">Activité / Motif</th>

                    <th className="p-3 text-center">Qté</th>

                    <th className="p-3">Agent</th>

                    <th className="p-3 text-center">Catégorie</th>

                    <th className="p-3 text-right">Montant</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {fluxFiltre.length > 0 ? (
                    fluxFiltre.map((item, index) => {
                      const nomDuSite = obtenirNomSite(
                        item.site_id || item.site || item.agence,
                      );

                      const designation =
                        item.designation ||
                        item.motif ||
                        item.description ||
                        item.nom ||
                        "Opération";

                      const nomAgent =
                        item.user_id?.username ||
                        item.vendeur_id?.username ||
                        item.vendeur ||
                        "Secrétariat";

                      const itemId = extractId(item._id);

                      const estVente = item.type === "vente";

                      const quantiteAffichee = estVente
                        ? formaterQuantiteVente(
                            item.quantite,
                            item.option_vente,
                          )
                        : item.isDepense
                          ? "-"
                          : Number(item.quantite) || 1;

                      return (
                        <tr
                          key={itemId || `flux-${index}`}
                          className="hover:bg-gray-50/50"
                        >
                          <td className="p-3 font-medium text-gray-400 whitespace-nowrap">
                            {formatDateEtHeure(item.createdAt || item.date)}
                          </td>

                          <td className="p-3">
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-semibold text-[10px]">
                              {nomDuSite}
                            </span>
                          </td>

                          <td
                            className={`p-3 font-semibold ${
                              item.isDepense ? "text-red-900" : "text-gray-900"
                            }`}
                          >
                            {designation}
                          </td>

                          <td className="p-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                            {quantiteAffichee}
                          </td>

                          <td className="p-3 text-gray-600 font-medium">
                            {nomAgent}
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.isDepense
                                  ? "bg-red-50 text-red-600"
                                  : "bg-purple-50 text-purple-600"
                              }`}
                            >
                              {item.isDepense ? "Dépense" : "Vente/Service"}
                            </span>
                          </td>

                          <td
                            className={`p-3 text-right font-black ${
                              item.isDepense ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {item.isDepense ? "- " : "+ "}
                            {item.montantCalcule.toLocaleString("fr-FR")} FCFA
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="7"
                        className="p-6 text-center text-gray-400 italic"
                      >
                        Aucune donnée trouvée avec ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ==================================================
              STOCKS
          ================================================== */}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  📦 État de l'Inventaire & Stocks
                </h2>

                <p className="text-xs text-gray-500">
                  Aperçu en temps réel des quantités disponibles par site
                </p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${
                  nombreAlertesStock > 0
                    ? "bg-red-100 text-red-600 border border-red-200"
                    : "bg-green-100 text-green-600"
                }`}
              >
                {nombreAlertesStock > 0
                  ? `⚠️ ${nombreAlertesStock} article(s) sous le seuil d'alerte`
                  : "✅ Tous les stocks sont suffisants"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-500">
                <thead className="bg-gray-50 text-gray-700 uppercase">
                  <tr>
                    <th className="p-3">Site / Agence</th>

                    <th className="p-3">Article / Désignation</th>

                    <th className="p-3 text-center">Quantité En Stock</th>

                    <th className="p-3 text-center">Seuil de Réappro.</th>

                    <th className="p-3 text-center">Statut</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {stocksFiltres.length > 0 ? (
                    stocksFiltres.map((stock, index) => {
                      const nomDuSite = obtenirNomSite(
                        stock.site_id || stock.site || stock.agence,
                      );

                      const quantite = Number(stock.quantite) || 0;

                      const seuil =
                        stock.seuil_alerte !== undefined &&
                        stock.seuil_alerte !== null
                          ? Number(stock.seuil_alerte)
                          : 5;

                      const enAlerte = quantite <= seuil;

                      const designationArticle =
                        stock.designation ||
                        stock.nom ||
                        stock.nom_article ||
                        "Article sans nom";

                      const stockId = extractId(stock._id);

                      return (
                        <tr
                          key={stockId || `stock-${index}`}
                          className={`hover:bg-gray-50/50 ${
                            enAlerte ? "bg-red-50/30" : ""
                          }`}
                        >
                          <td className="p-3">
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-semibold text-[10px]">
                              {nomDuSite}
                            </span>
                          </td>

                          <td className="p-3 font-bold text-gray-800">
                            {designationArticle}
                          </td>

                          <td
                            className={`p-3 text-center font-black text-sm ${
                              enAlerte ? "text-red-600" : "text-gray-800"
                            }`}
                          >
                            {formaterStock(stock)}
                          </td>

                          <td className="p-3 text-center font-medium text-gray-400">
                            {seuil}
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                enAlerte
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {enAlerte ? "⚠️ Stock Bas" : "✅ En Stock"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="p-6 text-center text-gray-400 italic"
                      >
                        Aucun article d'inventaire trouvé pour ces critères de
                        recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
