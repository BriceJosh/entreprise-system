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
     * Le prix est vidé pour que la secrétaire
     * saisisse le prix de la prochaine vente.
     */

    setPrixUnitaire('');

    setOptionVente('Pièce');

    setMotifDepense('');
    setMontantDepense('');

    setStockSelectionne(null);
  }

  /*
    * =========================================================
    * AJOUTER LA VENTE AU PANIER
    * =========================================================
    */

  function ajouterAuPanier() {
    setMessage({
      type: '',
      text: ''
    });

    if (!designation.trim()) {
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

    if (!stockSelectionne) {
      throw new Error(
        'Article introuvable dans le stock.'
      );
    }

    if (!prixVenteDuStock || prixVenteDuStock <= 0) {
      throw new Error(
        `Aucun prix de vente configuré pour "${designation}" en mode ${optionVente}.`
      );
    }

    setPanier(precedent => [
      ...precedent,
      {
        designation: designation.trim(),

        quantite: Number(quantite),

        option_vente: optionVente,

        prix_unitaire: prixVenteDuStock,

        montant:
          Number(quantite) * prixVenteDuStock
      }
    ]);

    /*
     * On garde l'article sélectionné pour faciliter
     * les ventes répétées, mais on remet la quantité à 1.
     */

    setQuantite(1);
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

        payload = {
          type: 'impression',

          service_type:
            serviceType,

          designation:
            SERVICE_LABELS[
              serviceType
            ] || serviceType,

          description,

          quantite:
            Number(quantite),

          prix_unitaire:
            Number(prixUnitaire)
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
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
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

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                Description
              </label>

              <input
                value={description}
                onChange={e =>
                  setDescription(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder="Détails facultatifs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">

              <input
                type="number"
                min="1"
                value={quantite}
                onChange={e =>
                  setQuantite(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder="Quantité"
              />

              <input
                type="number"
                min="0"
                value={prixUnitaire}
                onChange={e =>
                  setPrixUnitaire(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder="Prix unitaire"
                required
              />

            </div>

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
            PANIER / REÇU EN COURS (vente)
            =================================================== */}

        {typeOperation === 'vente' && panier.length > 0 && (
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-600">
                Reçu en cours ({panier.length} article{panier.length > 1 ? 's' : ''})
              </p>

              <button
                type="button"
                onClick={() => setPanier([])}
                className="text-xs font-bold text-red-500 hover:underline"
              >
                Vider
              </button>
            </div>

            <ul className="space-y-2">
              {panier.map((ligne, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100"
                >
                  <span className="font-semibold text-gray-700 truncate mr-2">
                    {ligne.designation}
                    <span className="text-gray-400 font-normal"> — {ligne.quantite} {ligne.option_vente}</span>
                  </span>

                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-gray-800">
                      {ligne.montant.toLocaleString('fr-FR')} F
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setPanier(precedent =>
                          precedent.filter((_, i) => i !== index)
                        )
                      }
                      className="text-red-400 hover:text-red-600 font-black px-1"
                      title="Retirer cette ligne"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            {/* SERVI PAR + NOM DU CLIENT + MONTANT PAYÉ */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

              <input
                value={serviPar}
                onChange={e => setServiPar(e.target.value)}
                className="p-3 rounded-xl border bg-white text-sm"
                placeholder="Servi par (facultatif)"
              />

              <input
                value={nomClient}
                onChange={e => setNomClient(e.target.value)}
                className="p-3 rounded-xl border bg-white text-sm"
                placeholder="Nom du client (facultatif)"
              />

              <input
                type="number"
                min="0"
                value={montantPaye}
                onChange={e => setMontantPaye(e.target.value)}
                className="p-3 rounded-xl border bg-white text-sm"
                placeholder="Montant payé (facultatif)"
              />

            </div>

            {/* TOTAL DU REÇU */}

            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 font-black text-right">
              TOTAL REÇU :{' '}
              {totalPanier.toLocaleString('fr-FR')} FCFA
            </div>

            {/* BOUTON VALIDER LE REÇU */}

            <button
              type="button"
              onClick={validerRecu}
              disabled={loading}
              className="w-full p-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50"
            >
              {loading
                ? 'Génération...'
                : 'Valider et imprimer le reçu'}
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
            VALIDATION
            =================================================== */}

        <button
          type="submit"
          disabled={loading}
          className="w-full p-3.5 rounded-xl bg-gray-900 text-white font-bold text-sm disabled:opacity-50"
        >
          {loading
            ? 'Enregistrement...'
            : 'Valider l’opération'}
        </button>

      </form>

    </div>
  );
}
