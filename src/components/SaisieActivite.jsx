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
   * Le prix est SAISI MANUELLEMENT par la secrétaire.
   *
   * Il n'est jamais récupéré automatiquement depuis le stock.
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
   * IMPORTANT :
   *
   * quantité saisie × prix saisi par la secrétaire
   *
   * Exemple :
   *
   * 2 Gros
   * Prix : 20 000
   *
   * Total = 40 000 FCFA
   */

  const totalVente = useMemo(
    () =>
      (Number(quantite) || 0) *
      (Number(prixUnitaire) || 0),
    [
      quantite,
      prixUnitaire
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
         * Le prix est obligatoirement saisi
         * manuellement par la secrétaire.
         */

        if (
          prixUnitaire === '' ||
          !Number.isFinite(
            Number(prixUnitaire)
          ) ||
          Number(prixUnitaire) < 0
        ) {
          throw new Error(
            'Veuillez saisir un prix de vente valide.'
          );
        }

        endpoint =
          `${BACKEND_URL}/api/activites`;

        payload = {
          type: 'vente',

          designation:
            designation.trim(),

          description,

          /*
           * Quantité dans le mode choisi :
           *
           * 2 Gros
           * 5 Détail
           * 3 Pièce
           */

          quantite:
            Number(quantite),

          /*
           * Prix d'une unité du mode choisi.
           *
           * Exemple :
           *
           * 1 Gros = 20 000 FCFA
           */

          prix_unitaire:
            Number(prixUnitaire),

          /*
           * Gros / Détail / Pièce
           */

          option_vente:
            optionVente
        };
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

            <div className="grid grid-cols-3 gap-3">

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
                    Pièce
                  </option>

                  <option value="Détail">
                    Détail
                  </option>

                  <option value="Gros">
                    Gros
                  </option>
                </select>
              </div>

              {/* PRIX MANUEL */}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Prix de vente
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prixUnitaire}
                  onChange={e =>
                    setPrixUnitaire(
                      e.target.value
                    )
                  }
                  className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                  placeholder="Prix"
                  required
                />
              </div>

            </div>

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
