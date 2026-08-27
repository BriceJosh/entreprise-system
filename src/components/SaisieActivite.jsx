import { useEffect, useMemo, useState, useCallback } from 'react';

import {
  PERMISSIONS,
  SERVICE_LABELS,
  getPermissionFlags,
  getServiceTypes,
  hasPermission
} from '../config/permissions';

import {
  formaterQuantiteVente,
  formaterStock
} from '../utils/formatStock';
import { BACKEND_URL } from '../config/api';
import { imprimerRecu } from '../utils/imprimerRecu';

export default function SaisieActivite({
  profil,
  onOperationAjoutee
}) {
  const flags = getPermissionFlags(profil);
  const serviceTypes = getServiceTypes(profil);

  /*
   * =========================================================
   * TYPE D'OPÉRATION PAR DÉFAUT
   * =========================================================
   */

  const defaultType = flags.services
    ? 'impression'
    : flags.vente
      ? 'vente'
      : flags.depense
        ? 'depense'
        : '';

  const [typeOperation, setTypeOperation] =
    useState(defaultType);

  const [serviceType, setServiceType] =
    useState(() => serviceTypes[0] || '');

  /*
   * =========================================================
   * CHAMPS COMMUNS
   * =========================================================
   */

  const [designation, setDesignation] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [quantite, setQuantite] =
    useState(1);

  /*
   * =========================================================
   * DIMENSIONS & CALCUL AU M² (Bâches, Autocollants...)
   * =========================================================
   */
  const [longueur, setLongueur] = useState('');
  const [largeur, setLargeur] = useState('');
  const [prixM2, setPrixM2] = useState('');

  const isServiceGrandFormat = useMemo(() => {
    return (
      serviceType === 'impression_bache' ||
      serviceType === 'impression_autocollant' ||
      serviceType === 'impression_dtf'
    );
  }, [serviceType]);

  const surfaceCalculee = useMemo(() => {
    const l = parseFloat(String(longueur).replace(',', '.'));
    const w = parseFloat(String(largeur).replace(',', '.'));
    if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
      return Number((l * w).toFixed(4));
    }
    return 0;
  }, [longueur, largeur]);

  useEffect(() => {
    if (isServiceGrandFormat && surfaceCalculee > 0 && prixM2) {
      const pm2 = parseFloat(String(prixM2).replace(',', '.'));
      if (!isNaN(pm2) && pm2 > 0) {
        const calPrixUnitaire = Math.round(surfaceCalculee * pm2);
        setPrixUnitaire(calPrixUnitaire);
      }
    }
  }, [isServiceGrandFormat, surfaceCalculee, prixM2]);

  /*
    * IMPORTANT :
    * Pour les VENTES, le prix n'est plus saisi.
    * Il est récupéré automatiquement depuis le stock
    * selon le mode de vente (Gros / Détail / Pièce).
    *
    * Le champ prixUnitaire ne sert plus que pour les
    * services (impression, etc.).
    */

  const [prixUnitaire, setPrixUnitaire] =
    useState('');

  /*
   * =========================================================
   * VENTE
   * =========================================================
   */

  const [optionVente, setOptionVente] =
    useState('Pièce');

  /*
   * Stock actuellement chargé
   */

  const [listeStocks, setListeStocks] =
    useState([]);

  /*
   * Produit actuellement sélectionné
   *
   * Sert uniquement à afficher son stock sous forme humaine.
   */

  const [stockSelectionne, setStockSelectionne] =
    useState(null);

  /*
    * =========================================================
    * PANIER (REÇU EN COURS)
    * =========================================================
    *
    * Le client peut acheter un ou plusieurs articles.
    * Chaque ligne validée est ajoutée au panier, puis
    * l'ensemble est enregistré et imprimé en UN SEUL reçu.
    */

  const [panier, setPanier] = useState([]);

  const [nomClient, setNomClient] = useState('');

  const [montantPaye, setMontantPaye] = useState('');

  /*
   * Nom de la personne qui a servi le client.
   *
   * Facultatif : s'il est vide, le reçu affiche le nom du
   * compte connecté. La valeur est volontairement conservée
   * d'un reçu à l'autre pour éviter de la retaper.
   */

  const [serviPar, setServiPar] = useState('');

  const totalPanier = useMemo(
    () =>
      panier.reduce(
        (somme, ligne) =>
          somme + ligne.montant,
        0
      ),
    [panier]
  );

  /*
    * =========================================================
    * DÉPENSE
    * =========================================================
    */

  const [motifDepense, setMotifDepense] =
    useState('');

  const [montantDepense, setMontantDepense] =
    useState('');

  /*
   * =========================================================
   * ÉTAT
   * =========================================================
   */

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState({
      type: '',
      text: ''
    });



  /*
   * =========================================================
   * CHARGER LES STOCKS
   * =========================================================
   */

  const chargerStock = useCallback(async () => {
    try {
      const token =
        localStorage.getItem('token');

      const response = await fetch(
        `${BACKEND_URL}/api/stocks`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      const stocks =
        Array.isArray(data)
          ? data
          : [];

      setListeStocks(stocks);

      /*
       * Si un produit était déjà sélectionné,
       * on met également à jour son stock.
       */

      if (designation.trim()) {
        const stock =
          stocks.find(
            item =>
              item.nom_article
                ?.toLowerCase() ===
              designation
                .trim()
                .toLowerCase()
          );

        setStockSelectionne(
          stock || null
        );
      }
    } catch (error) {
      console.error(
        'Erreur chargement stock :',
        error
      );
    }
  }, [designation]);

  /*
   * =========================================================
   * CHARGEMENT DU STOCK
   * =========================================================
   */

  useEffect(() => {
    if (
      typeOperation === 'vente' &&
      flags.vente
    ) {
      chargerStock();
    }
  }, [
    typeOperation,
    flags.vente,
    chargerStock
  ]);

  /*
    * =========================================================
    * TOTAL DE LA VENTE
    * =========================================================
    *
    * Le prix unitaire est récupéré AUTOMATIQUEMENT depuis
    * le stock selon le mode de vente :
    *
    * - Gros   → prix_vente_gros
    * - Détail → prix_vente_detail
    * - Pièce  → prix_vente_unite
    */

  const prixVenteDuStock = useMemo(() => {
    if (!stockSelectionne) {
      return 0;
    }

    switch (optionVente) {
      case 'Gros':
        return Number(stockSelectionne.prix_vente_gros) || 0;

      case 'Détail':
        return Number(stockSelectionne.prix_vente_detail) || 0;

      default:
        return (
          Number(stockSelectionne.prix_vente_unite) ||
          Number(stockSelectionne.prix_vente) ||
          0
        );
    }
  }, [stockSelectionne, optionVente]);

  const totalVente = useMemo(
    () =>
      (Number(quantite) || 0) * prixVenteDuStock,
    [
      quantite,
      prixVenteDuStock
    ]
  );



  /*
   * =========================================================
   * CHOIX DU PRODUIT
   * =========================================================
   *
   * IMPORTANT :
   *
   * Cette fonction NE TOUCHE PAS au prix.
   *
   * La secrétaire doit saisir elle-même le prix.
   */

  function choisirProduit(value) {
    setDesignation(value);

    const stock =
      listeStocks.find(
        item =>
          item.nom_article
            ?.toLowerCase() ===
          value.trim().toLowerCase()
      );

    setStockSelectionne(
      stock || null
    );
  }

  /*
   * =========================================================
   * RESET DU FORMULAIRE
   * =========================================================
   */

  function resetForm() {
    setDesignation('');
    setDescription('');
    setQuantite(1);

    /*
     * Le prix et les dimensions sont vidés.
     */
    setPrixUnitaire('');
    setLongueur('');
    setLargeur('');
    setPrixM2('');

    setOptionVente('Pièce');

    setMotifDepense('');
    setMontantDepense('');

    setStockSelectionne(null);
  }

  /*
   * =========================================================
   * AJOUTER UNE VENTE OU UN SERVICE AU PANIER DU REÇU
   * =========================================================
   */

  function ajouterAuPanier() {
    setMessage({
      type: '',
      text: ''
    });

    if (typeOperation === 'vente') {
      if (!designation.trim()) {
        throw new Error('Sélectionnez un article à vendre.');
      }

      if (!quantite || Number(quantite) <= 0) {
        throw new Error('La quantité doit être supérieure à 0.');
      }

      if (!stockSelectionne) {
        throw new Error('Article introuvable dans le stock.');
      }

      if (!prixVenteDuStock || prixVenteDuStock <= 0) {
        throw new Error(
          `Aucun prix de vente configuré pour "${designation}" en mode ${optionVente}.`
        );
      }

      setPanier(precedent => [
        ...precedent,
        {
          idTemporaire: Date.now() + Math.random(),
          type: 'vente',
          designation: designation.trim(),
          quantite: Number(quantite),
          option_vente: optionVente,
          prix_unitaire: prixVenteDuStock,
          montant: Number(quantite) * prixVenteDuStock
        }
      ]);

      setQuantite(1);
    } else if (typeOperation === 'impression') {
      if (!serviceType) {
        throw new Error('Sélectionnez un type de service.');
      }

      if (!quantite || Number(quantite) <= 0) {
        throw new Error('La quantité doit être supérieure à 0.');
      }

      const pu = Number(prixUnitaire);
      if (!Number.isFinite(pu) || pu <= 0) {
        throw new Error('Indiquez un prix unitaire valide (ou renseignez les dimensions et le prix/m²).');
      }

      const numLongueur = longueur ? parseFloat(String(longueur).replace(',', '.')) : null;
      const numLargeur = largeur ? parseFloat(String(largeur).replace(',', '.')) : null;
      const numPrixM2 = prixM2 ? parseFloat(String(prixM2).replace(',', '.')) : null;

      let descFinale = description.trim();
      if (numLongueur > 0 && numLargeur > 0 && !descFinale) {
        descFinale = `${numLongueur}m × ${numLargeur}m (${surfaceCalculee} m²)`;
      }

      setPanier(precedent => [
        ...precedent,
        {
          idTemporaire: Date.now() + Math.random(),
          type: 'impression',
          service_type: serviceType,
          designation: SERVICE_LABELS[serviceType] || serviceType,
          description: descFinale,
          quantite: Number(quantite),
          option_vente: 'Service',
          prix_unitaire: pu,
          montant: Math.round(Number(quantite) * pu),
          longueur: numLongueur > 0 ? numLongueur : null,
          largeur: numLargeur > 0 ? numLargeur : null,
          surface_m2: surfaceCalculee > 0 ? surfaceCalculee : null,
          prix_m2: numPrixM2 > 0 ? numPrixM2 : null
        }
      ]);

      setQuantite(1);
      setDescription('');
      setLongueur('');
      setLargeur('');
      setPrixM2('');
      setPrixUnitaire('');
    }
  }

  /*
    * =========================================================
    * VALIDER LE PANIER → CRÉATION DU REÇU
    * =========================================================
    */

  async function validerRecu() {
    setLoading(true);

    setMessage({
      type: '',
      text: ''
    });

    try {
      const token =
        localStorage.getItem('token');

      const response = await fetch(
        `${BACKEND_URL}/api/recus`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization:
              `Bearer ${token}`
          },

          body: JSON.stringify({
            nom_client: nomClient,

            servi_par: serviPar.trim(),

            montant_paye:
              montantPaye !== ''
                ? Number(montantPaye)
                : undefined,

            lignes: panier
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          'Erreur lors de la création du reçu.'
        );
      }

      /*
       * Impression automatique du reçu.
       */

      imprimerRecu(data.recu);

      setMessage({
        type: 'success',

        text:
          `Reçu ${data.recu.numero} généré : ${totalPanier.toLocaleString('fr-FR')} FCFA.`
      });

      /*
       * RESET DU PANIER
       */

      setPanier([]);
      setNomClient('');
      setMontantPaye('');

      resetForm();

      await chargerStock();

      /*
       * NOTE : on n'appelle PAS onOperationAjoutee ici.
       *
       * Les ventes individuelles arrivent déjà via le socket
       * 'activite_ajoutee' ; ajouter aussi le reçu créerait
       * un double comptage.
       */
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  /*
    * =========================================================
    * ENREGISTREMENT
    * =========================================================
    */

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);

    setMessage({
      type: '',
      text: ''
    });

    const token =
      localStorage.getItem('token');

    const headers = {
      'Content-Type':
        'application/json',

      Authorization:
        `Bearer ${token}`
    };

    try {
      let endpoint;
      let payload;

      /*
       * =====================================================
       * DÉPENSE
       * =====================================================
       */

      if (
        typeOperation === 'depense'
      ) {
        if (
          !hasPermission(
            profil,
            PERMISSIONS.DEPENSE
          )
        ) {
          throw new Error(
            'Vous n’êtes pas autorisé à enregistrer des dépenses.'
          );
        }

        if (
          !motifDepense.trim()
        ) {
          throw new Error(
            'Le motif de la dépense est obligatoire.'
          );
        }

        if (
          !montantDepense ||
          Number(montantDepense) <= 0
        ) {
          throw new Error(
            'Le montant de la dépense doit être supérieur à 0.'
          );
        }

        endpoint =
          `${BACKEND_URL}/api/depenses`;

        payload = {
          motif:
            motifDepense.trim(),

          montant:
            Number(montantDepense)
        };
      }

      /*
       * =====================================================
       * VENTE
       * =====================================================
       */

      else if (
        typeOperation === 'vente'
      ) {
        if (!flags.vente) {
          throw new Error(
            'Vous n’êtes pas autorisé à enregistrer des ventes.'
          );
        }

        if (
          !designation.trim()
        ) {
          throw new Error(
            'Sélectionnez un article à vendre.'
          );
        }

        if (
          !quantite ||
          Number(quantite) <= 0
        ) {
          throw new Error(
            'La quantité doit être supérieure à 0.'
          );
        }

        /*
          * Le prix n'est plus saisi : il est récupéré
          * automatiquement depuis le stock par le backend.
          * On vérifie juste qu'un prix est bien configuré.
          */

        if (!prixVenteDuStock || prixVenteDuStock <= 0) {
          throw new Error(
            `Aucun prix de vente configuré pour "${designation}" en mode ${optionVente}.`
          );
        }

        /*
          * La vente est ajoutée AU PANIER.
          * Le reçu est généré séparément via
          * "Valider et imprimer le reçu".
          */

        ajouterAuPanier();

        setMessage({
          type: 'success',
          text:
            `${designation} ajouté au reçu en cours.`
        });

        setQuantite(1);

        return;
      }

      /*
       * =====================================================
       * IMPRESSION / SERVICE
       * =====================================================
       */

      else if (
        typeOperation === 'impression'
      ) {
        if (
          !flags.services ||
          !serviceType
        ) {
          throw new Error(
            'Vous n’êtes pas autorisé à enregistrer ce service.'
          );
        }

        endpoint =
          `${BACKEND_URL}/api/activites`;

        const numLongueur = longueur ? parseFloat(String(longueur).replace(',', '.')) : null;
        const numLargeur = largeur ? parseFloat(String(largeur).replace(',', '.')) : null;
        const numPrixM2 = prixM2 ? parseFloat(String(prixM2).replace(',', '.')) : null;

        let descFinale = description;
        if (numLongueur > 0 && numLargeur > 0 && (!descFinale || descFinale.trim() === '')) {
          descFinale = `Dim: ${numLongueur}m × ${numLargeur}m (${surfaceCalculee} m²)`;
        }

        payload = {
          type: 'impression',

          service_type:
            serviceType,

          designation:
            SERVICE_LABELS[
              serviceType
            ] || serviceType,

          description: descFinale,

          quantite:
            Number(quantite),

          prix_unitaire:
            Number(prixUnitaire),

          longueur: numLongueur > 0 ? numLongueur : null,
          largeur: numLargeur > 0 ? numLargeur : null,
          surface_m2: surfaceCalculee > 0 ? surfaceCalculee : null,
          prix_m2: numPrixM2 > 0 ? numPrixM2 : null
        };
      }

      /*
       * =====================================================
       * TYPE INCONNU
       * =====================================================
       */

      else {
        throw new Error(
          'Aucune opération disponible pour ce profil.'
        );
      }

      /*
       * =====================================================
       * REQUÊTE
       * =====================================================
       */

      const response =
        await fetch(
          endpoint,
          {
            method: 'POST',
            headers,
            body:
              JSON.stringify(payload)
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          'Erreur lors de l’enregistrement.'
        );
      }

      /*
       * =====================================================
       * SUCCÈS
       * =====================================================
       */

      setMessage({
        type: 'success',

        text:
          data.message ||
          'Opération enregistrée avec succès.'
      });

      resetForm();

      onOperationAjoutee?.(
        data.activite ||
        data.depense ||
        data
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      });
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================================
   * ONGLETS
   * =========================================================
   */

  const tabs = [
    ...(flags.services
      ? [
          {
            id: 'impression',
            label: 'Services'
          }
        ]
      : []),

    ...(flags.vente
      ? [
          {
            id: 'vente',
            label: 'Vente produit'
          }
        ]
      : []),

    ...(flags.depense
      ? [
          {
            id: 'depense',
            label: 'Dépense'
          }
        ]
      : [])
  ];

  /*
   * =========================================================
   * AUCUNE OPÉRATION
   * =========================================================
   */

  if (!tabs.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-gray-500">
        Aucune opération n’est disponible
        pour votre profil.
      </div>
    );
  }

  /*
   * =========================================================
   * INTERFACE
   * =========================================================
   */

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

      {/* =====================================================
          TITRE
          ===================================================== */}

      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-black text-gray-800">
            Enregistrer une activité
          </h2>

          <p className="text-xs text-gray-400 mt-1">
            Les opérations sont automatiquement
            rattachées à votre compte.
          </p>
        </div>
      </div>

      {/* =====================================================
          ONGLETS
          ===================================================== */}

      <div className="flex flex-wrap gap-2 mb-6">

        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              setTypeOperation(tab.id)
            }
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              typeOperation === tab.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}

      </div>

      {/* =====================================================
          MESSAGE
          ===================================================== */}

      {message.text && (
        <div
          className={`mb-5 p-3 rounded-xl text-sm font-semibold ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* =====================================================
          FORMULAIRE
          ===================================================== */}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >

        {/* ===================================================
            SERVICES
            =================================================== */}

        {typeOperation === 'impression' && (
          <>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                Service autorisé
              </label>

              <select
                value={serviceType}
                onChange={e =>
                  setServiceType(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm font-semibold"
              >
                {serviceTypes.map(type => (
                  <option
                    key={type}
                    value={type}
                  >
                    {SERVICE_LABELS[type] ||
                      type}
                  </option>
                ))}
              </select>
            </div>

            {/* Champs de dimensions pour Bâches, Autocollants et Grand Format */}
            {isServiceGrandFormat && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                    📐 Dimensions de l'impression (au m²)
                  </span>
                  {surfaceCalculee > 0 && (
                    <span className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                      {surfaceCalculee} m²
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Longueur (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={longueur}
                      onChange={e => setLongueur(e.target.value)}
                      className="w-full p-2.5 rounded-lg border bg-white text-sm"
                      placeholder="Ex: 0.5 ou 2.0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Largeur (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={largeur}
                      onChange={e => setLargeur(e.target.value)}
                      className="w-full p-2.5 rounded-lg border bg-white text-sm"
                      placeholder="Ex: 0.5 ou 1.2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Prix au m² (FCFA)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={prixM2}
                    onChange={e => setPrixM2(e.target.value)}
                    className="w-full p-2.5 rounded-lg border bg-white text-sm font-semibold"
                    placeholder="Ex: 1500"
                  />
                </div>

                {surfaceCalculee > 0 && (
                  <div className="text-xs text-blue-800 bg-white p-2.5 rounded-lg border border-blue-100 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>Calcul surface :</span>
                      <span className="font-semibold">{longueur}m × {largeur}m = <strong>{surfaceCalculee} m²</strong></span>
                    </div>
                    {prixM2 && (
                      <div className="flex justify-between pt-1 border-t border-blue-50 text-blue-900 font-bold">
                        <span>Prix par exemplaire :</span>
                        <span>{surfaceCalculee} m² × {prixM2} F = {Math.round(surfaceCalculee * Number(prixM2)).toLocaleString()} FCFA</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                Description / Précisions
              </label>

              <input
                value={description}
                onChange={e =>
                  setDescription(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder={isServiceGrandFormat ? "Ex: Oeillets, finition renforcée..." : "Détails facultatifs"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Nombre d'exemplaires (Qté)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantite}
                  onChange={e =>
                    setQuantite(
                      e.target.value
                    )
                  }
                  className="w-full p-3 rounded-xl border bg-gray-50 text-sm font-semibold"
                  placeholder="Quantité"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Prix unitaire (FCFA / pièce)
                </label>
                <input
                  type="number"
                  min="0"
                  value={prixUnitaire}
                  onChange={e =>
                    setPrixUnitaire(
                      e.target.value
                    )
                  }
                  className="w-full p-3 rounded-xl border bg-gray-50 text-sm font-bold text-emerald-800"
                  placeholder="Prix unitaire"
                  required
                />
              </div>
            </div>

            {Number(quantite) > 1 && Number(prixUnitaire) > 0 && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex justify-between font-bold">
                <span>Total à encaisser ({quantite} pcs) :</span>
                <span>{(Number(quantite) * Number(prixUnitaire)).toLocaleString()} FCFA</span>
              </div>
            )}

          </>
        )}

        {/* ===================================================
            VENTE
            =================================================== */}

        {typeOperation === 'vente' && (
          <>

            {/* ===============================================
                ARTICLE
                =============================================== */}

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                Article
              </label>

              <input
                list="stocks-vente"
                value={designation}
                onChange={e =>
                  choisirProduit(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder="Choisir un produit"
                required
              />

              <datalist id="stocks-vente">
                {listeStocks.map(stock => (
                  <option
                    key={stock._id}
                    value={stock.nom_article}
                  />
                ))}
              </datalist>
            </div>

            {/* ===============================================
                STOCK DISPONIBLE
                =============================================== */}

            {stockSelectionne && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">

                <div className="text-xs text-blue-500 font-bold mb-1">
                  Stock disponible
                </div>

                <div className="text-sm font-black text-blue-800">
                  {formaterStock(
                    stockSelectionne
                  )}
                </div>

              </div>
            )}

            {/* ===============================================
                QUANTITÉ / MODE / PRIX
                =============================================== */}

            <div className="grid grid-cols-2 gap-3">

              {/* QUANTITÉ */}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Quantité
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantite}
                  onChange={e =>
                    setQuantite(
                      e.target.value
                    )
                  }
                  className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                  required
                />
              </div>

              {/* MODE DE VENTE */}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Mode de vente
                </label>

                <select
                  value={optionVente}
                  onChange={e =>
                    setOptionVente(
                      e.target.value
                    )
                  }
                  className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                >
                  <option value="Pièce">
                    Pièce / Unité
                  </option>

                  <option value="Détail">
                    Détail
                  </option>

                  <option value="Gros">
                    Gros
                  </option>
                </select>
              </div>

            </div>

            {/* ===============================================
                PRIX RÉCUPÉRÉ AUTOMATIQUEMENT DU STOCK
                =============================================== */}

            {stockSelectionne && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">

                <span className="text-xs font-bold text-indigo-500">
                  Prix {optionVente} (automatique)
                </span>

                <span className="text-sm font-black text-indigo-800">
                  {prixVenteDuStock.toLocaleString('fr-FR')} FCFA
                </span>

              </div>
            )}

            {/* ===============================================
                RAPPEL DE LA VENTE
                =============================================== */}

            {designation.trim() && (
              <div className="text-xs text-gray-500">
                Vente de{' '}
                <strong>
                  {formaterQuantiteVente(
                    quantite,
                    optionVente
                  )}
                </strong>
              </div>
            )}

            {/* ===============================================
                TOTAL
                =============================================== */}

            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 font-black text-right">

              Total :{' '}
              {totalVente.toLocaleString(
                'fr-FR'
              )}{' '}
              FCFA

            </div>

          </>
        )}

        {/* ===================================================
            PANIER / REÇU EN COURS (Partagé Vente & Services)
            =================================================== */}

        {panier.length > 0 && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3 mt-4 shadow-sm">

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span>🧾</span> Reçu en cours ({panier.length} ligne{panier.length > 1 ? 's' : ''})
              </p>

              <button
                type="button"
                onClick={() => setPanier([])}
                className="text-xs font-bold text-red-500 hover:underline cursor-pointer"
              >
                Vider le reçu
              </button>
            </div>

            <ul className="space-y-2">
              {panier.map((ligne, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-xs"
                >
                  <div className="truncate mr-2">
                    <span className="font-semibold text-gray-800">
                      {ligne.designation}
                    </span>
                    {ligne.type === 'impression' ? (
                      <div className="text-[11px] text-blue-600 font-normal">
                        Service • {ligne.quantite} ex.
                        {ligne.surface_m2 ? ` • Dim: ${ligne.longueur}m × ${ligne.largeur}m (${ligne.surface_m2} m²)` : ''}
                        {ligne.description ? ` • ${ligne.description}` : ''}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 font-normal">
                        Article • {ligne.quantite} {ligne.option_vente} ({ligne.prix_unitaire.toLocaleString('fr-FR')} F/unité)
                      </div>
                    )}
                  </div>

                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-gray-900">
                      {ligne.montant.toLocaleString('fr-FR')} FCFA
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setPanier(precedent =>
                          precedent.filter((_, i) => i !== index)
                        )
                      }
                      className="text-red-400 hover:text-red-600 font-black px-1.5 py-0.5 rounded hover:bg-red-50 cursor-pointer"
                      title="Retirer cette ligne"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            {/* SERVI PAR + NOM DU CLIENT + MONTANT PAYÉ */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-blue-100">

              <input
                value={serviPar}
                onChange={e => setServiPar(e.target.value)}
                className="p-2.5 rounded-xl border bg-white text-xs font-medium"
                placeholder="Servi par (facultatif)"
              />

              <input
                value={nomClient}
                onChange={e => setNomClient(e.target.value)}
                className="p-2.5 rounded-xl border bg-white text-xs font-medium"
                placeholder="Nom du client (facultatif)"
              />

              <input
                type="number"
                min="0"
                value={montantPaye}
                onChange={e => setMontantPaye(e.target.value)}
                className="p-2.5 rounded-xl border bg-white text-xs font-semibold"
                placeholder="Montant payé (FCFA)"
              />

            </div>

            {/* TOTAL DU REÇU & MONNAIE RENDUE */}

            <div className="p-3.5 rounded-xl bg-emerald-600 text-white font-black flex justify-between items-center shadow-xs">
              <span className="text-xs uppercase tracking-wider text-emerald-100">
                Total Reçu :
              </span>
              <span className="text-base">
                {totalPanier.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            {Number(montantPaye) > 0 && (
              <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-bold">
                <span>Monnaie à rendre :</span>
                <span className="text-sm">
                  {Number(montantPaye) >= totalPanier
                    ? `${(Number(montantPaye) - totalPanier).toLocaleString('fr-FR')} FCFA`
                    : `⚠️ Reste à payer : ${(totalPanier - Number(montantPaye)).toLocaleString('fr-FR')} FCFA`}
                </span>
              </div>
            )}

            {/* BOUTON VALIDER LE REÇU */}

            <button
              type="button"
              onClick={validerRecu}
              disabled={loading}
              className="w-full p-3.5 rounded-xl bg-gray-900 hover:bg-black text-white font-black text-sm disabled:opacity-50 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🖨️</span>
              {loading
                ? 'Génération et impression...'
                : 'Valider et imprimer le reçu complet'}
            </button>

          </div>
        )}

        {/* ===================================================
            DÉPENSE
            =================================================== */}

        {typeOperation === 'depense' && (
          <>

            <input
              value={motifDepense}
              onChange={e =>
                setMotifDepense(
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
              placeholder="Motif de la dépense"
              required
            />

            <input
              type="number"
              min="1"
              value={montantDepense}
              onChange={e =>
                setMontantDepense(
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
              placeholder="Montant en FCFA"
              required
            />

          </>
        )}

        {/* ===================================================
            BOUTONS D'ACTION SELON LE TYPE D'OPÉRATION
            =================================================== */}

        {typeOperation === 'depense' ? (
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-sm cursor-pointer"
          >
            {loading ? 'Enregistrement...' : '💸 Enregistrer la dépense'}
          </button>
        ) : (
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                try {
                  ajouterAuPanier();
                } catch (e) {
                  setMessage({ type: 'error', text: e.message });
                }
              }}
              disabled={loading}
              className="w-full p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <span>➕</span>
              Ajouter au reçu en cours
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-full p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Enregistrement...' : '⚡ Enregistrer directement (sans reçu)'}
            </button>
          </div>
        )}

      </form>

    </div>
  );
}
