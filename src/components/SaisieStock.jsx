import { useEffect, useState } from 'react';
import { getPermissionFlags } from '../config/permissions';
import { BACKEND_URL } from '../config/api';

export default function SaisieStock({
  profil,
  siteId,
  onStockAjoute
}) {
  const flags = getPermissionFlags(profil);

  const [nomNouvelArticle, setNomNouvelArticle] =
    useState('');

  const [quantiteStockEntrante, setQuantiteStockEntrante] =
    useState('');

  const [typeEntree, setTypeEntree] =
    useState('Pièce');

  const [seuilAlerte, setSeuilAlerte] =
    useState('5');

  const [multiplicateurDetail, setMultiplicateurDetail] =
    useState('1');

  const [multiplicateurGros, setMultiplicateurGros] =
    useState('1');

  /*
    * =========================================================
    * PRIX DE VENTE MULTI-NIVEAUX
    * =========================================================
    *
    * - Entrée en Gros   : saisir gros + détail + unité
    * - Entrée en Détail : saisir détail + unité
    * - Entrée en Pièce  : saisir unité uniquement
    *
    * Le prix total est calculé AUTOMATIQUEMENT :
    * - Gros   → quantité × prix DÉTAIL
    * - Détail → quantité × prix UNITÉ
    * - Pièce  → quantité × prix UNITÉ
    */

  const [prixVenteGros, setPrixVenteGros] =
    useState('');

  const [prixVenteDetail, setPrixVenteDetail] =
    useState('');

  const [prixVenteUnite, setPrixVenteUnite] =
    useState('');

  const [stocksExistants, setStocksExistants] =
    useState([]);

  const [articleExistant, setArticleExistant] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState({
      type: '',
      text: ''
    });

  /*
   * =========================================================
   * CHARGER STOCKS
   * =========================================================
   */

  useEffect(() => {
    if (
      siteId &&
      flags.stockGestion
    ) {
      chargerStocksDuSite();
    }
  }, [
    siteId,
    flags.stockGestion
  ]);

  async function chargerStocksDuSite() {
    try {
      const token =
        localStorage.getItem('token');

      const response =
        await fetch(
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

      setStocksExistants(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {
      console.error(
        'Erreur chargement stocks :',
        error
      );
    }
  }

  /*
   * =========================================================
   * ARTICLE
   * =========================================================
   */

  function handleNomArticleChange(value) {
    setNomNouvelArticle(value);

    const article =
      stocksExistants.find(
        item =>
          item.nom_article
            ?.toLowerCase() ===
          value
            .trim()
            .toLowerCase()
      );

    setArticleExistant(
      article || null
    );

    /*
     * ARTICLE EXISTANT
     *
     * On récupère automatiquement ses paramètres.
     */

    if (article) {
      if (
        article.seuil_alerte !==
        undefined
      ) {
        setSeuilAlerte(
          String(
            article.seuil_alerte
          )
        );
      }

      if (
        article.multiplicateur_detail !==
        undefined
      ) {
        setMultiplicateurDetail(
          String(
            article.multiplicateur_detail
          )
        );
      }

      if (
        article.multiplicateur_gros !==
        undefined
      ) {
        setMultiplicateurGros(
          String(
            article.multiplicateur_gros
          )
        );
      }

      /*
        * Pré-remplissage des prix de vente existants.
        */

      setPrixVenteUnite(
        article.prix_vente_unite !== undefined &&
        article.prix_vente_unite !== null
          ? String(article.prix_vente_unite)
          : article.prix_vente !== undefined &&
              article.prix_vente !== null
            ? String(article.prix_vente)
            : ''
      );

      setPrixVenteDetail(
        article.prix_vente_detail
          ? String(article.prix_vente_detail)
          : ''
      );

      setPrixVenteGros(
        article.prix_vente_gros
          ? String(article.prix_vente_gros)
          : ''
      );

      /*
       * Pour un article existant, les multiplicateurs
       * ne sont pas modifiés dans ce formulaire.
       */
    }
  }

  /*
   * =========================================================
   * CALCUL VISUEL
   * =========================================================
   */

  function obtenirMultiplicateur() {
    if (
      articleExistant
    ) {
      if (
        typeEntree === 'Gros'
      ) {
        return Number(
          articleExistant.multiplicateur_gros
        ) || 1;
      }

      if (
        typeEntree === 'Détail'
      ) {
        return Number(
          articleExistant.multiplicateur_detail
        ) || 1;
      }

      return 1;
    }

    if (
      typeEntree === 'Gros'
    ) {
      return (
        Number(
          multiplicateurGros
        ) || 1
      );
    }

    if (
      typeEntree === 'Détail'
    ) {
      return (
        Number(
          multiplicateurDetail
        ) || 1
      );
    }

    return 1;
  }

  const quantiteNumerique =
    Number(
      quantiteStockEntrante
    ) || 0;

  const multiplicateur =
    obtenirMultiplicateur();

  const quantiteEnUnites =
    quantiteNumerique *
    multiplicateur;

  /*
    * =========================================================
    * PRIX TOTAL AUTOMATIQUE
    * =========================================================
    */

  const prixUniteNumerique =
    Number(prixVenteUnite) || 0;

  const prixDetailNumerique =
    Number(prixVenteDetail) || 0;

  /*
    * Prix unitaire utilisé pour le calcul du total :
    * - Gros   → prix DÉTAIL
    * - Détail → prix UNITÉ
    * - Pièce  → prix UNITÉ
    */

  const prixUnitaireCalcul =
    typeEntree === 'Gros'
      ? prixDetailNumerique
      : prixUniteNumerique;

  /*
    * =========================================================
    * PRIX TOTAL AUTOMATIQUE
    * =========================================================
    *
    * - Entrée en Gros   :
    *     nbre de détails = qte × multGros ÷ multDétail
    *     total = nbre de détails × prix DÉTAIL
    *
    * - Entrée en Détail :
    *     nbre d'unités = qte × multDétail
    *     total = nbre d'unités × prix UNITÉ
    *
    * - Entrée en Pièce  :
    *     total = qte × prix UNITÉ
    */

  let prixTotalCalcule = 0;

  if (typeEntree === 'Gros') {
    const multGros =
      articleExistant
        ? Number(articleExistant.multiplicateur_gros) || 1
        : Number(multiplicateurGros) || 1;

    const multDetail =
      articleExistant
        ? Number(articleExistant.multiplicateur_detail) || 1
        : Number(multiplicateurDetail) || 1;

    const nombreDetails =
      (quantiteNumerique * multGros) / multDetail;

    prixTotalCalcule =
      nombreDetails * prixDetailNumerique;
  } else if (typeEntree === 'Détail') {
    const multDetail =
      articleExistant
        ? Number(articleExistant.multiplicateur_detail) || 1
        : Number(multiplicateurDetail) || 1;

    const nombreUnites =
      quantiteNumerique * multDetail;

    prixTotalCalcule =
      nombreUnites * prixUniteNumerique;
  } else {
    prixTotalCalcule =
      quantiteNumerique * prixUniteNumerique;
  }

  /*
   * =========================================================
   * SOUMISSION
   * =========================================================
   */

  async function handleAjouterStock(
    event
  ) {
    event.preventDefault();

    setMessage({
      type: '',
      text: ''
    });

    if (
      !flags.stockGestion
    ) {
      setMessage({
        type: 'error',
        text:
          'Vous n’êtes pas autorisé à gérer le stock.'
      });

      return;
    }

    if (
      !nomNouvelArticle.trim()
    ) {
      setMessage({
        type: 'error',
        text:
          "Veuillez saisir le nom de l'article."
      });

      return;
    }

    if (
      !Number.isFinite(
        quantiteNumerique
      ) ||
      quantiteNumerique <= 0
    ) {
      setMessage({
        type: 'error',
        text:
          'Veuillez saisir une quantité valide.'
      });

      return;
    }

    /*
      * =======================================================
      * VALIDATION DES PRIX SELON LE TYPE D'ENTRÉE
      * =======================================================
      */

    const prixUniteSaisi =
      Number(prixVenteUnite);

    const prixDetailSaisi =
      Number(prixVenteDetail);

    const prixGrosSaisi =
      Number(prixVenteGros);

    if (
      !Number.isFinite(prixUniteSaisi) ||
      prixUniteSaisi < 0 ||
      prixVenteUnite === ''
    ) {
      setMessage({
        type: 'error',
        text:
          "Le prix de vente à l'unité est obligatoire."
      });

      return;
    }

    if (
      (typeEntree === 'Gros' ||
        typeEntree === 'Détail') &&
      (prixVenteDetail === '' ||
        !Number.isFinite(prixDetailSaisi) ||
        prixDetailSaisi < 0)
    ) {
      setMessage({
        type: 'error',
        text:
          "Le prix de vente à la détail est obligatoire pour une entrée en gros ou en détail."
      });

      return;
    }

    if (
      typeEntree === 'Gros' &&
      (prixVenteGros === '' ||
        !Number.isFinite(prixGrosSaisi) ||
        prixGrosSaisi < 0)
    ) {
      setMessage({
        type: 'error',
        text:
          "Le prix de vente en gros est obligatoire pour une entrée en gros."
      });

      return;
    }

    /*
     * Pour un nouvel article, les multiplicateurs sont
     * obligatoires et doivent être valides.
     */

    if (!articleExistant) {
      if (
        Number(multiplicateurGros) < 1 ||
        Number(multiplicateurDetail) < 1
      ) {
        setMessage({
          type: 'error',
          text:
            'Les multiplicateurs Gros et Détail doivent être au moins égaux à 1.'
        });

        return;
      }
    }

    setIsSubmitting(true);

    try {
      const token =
        localStorage.getItem('token');

      const payload = {
        nom_article:
          nomNouvelArticle.trim(),

        quantite:
          quantiteNumerique,

        type_entree:
          typeEntree,

        seuil_alerte:
          Number(seuilAlerte) || 5,

        /*
          * Prix de vente multi-niveaux.
          *
          * Le prix total n'est PAS envoyé : il est calculé
          * automatiquement par le backend.
          */

        prix_vente_unite:
          prixUniteSaisi,

        site_id:
          siteId
      };

      if (
        typeEntree === 'Gros' ||
        typeEntree === 'Détail'
      ) {
        payload.prix_vente_detail =
          prixDetailSaisi;
      }

      if (typeEntree === 'Gros') {
        payload.prix_vente_gros =
          prixGrosSaisi;
      }

      /*
       * Les multiplicateurs ne sont envoyés que pour
       * un nouvel article.
       */

      if (!articleExistant) {
        payload.multiplicateur_detail =
          Number(
            multiplicateurDetail
          );

        payload.multiplicateur_gros =
          Number(
            multiplicateurGros
          );
      }

      const response =
        await fetch(
          `${BACKEND_URL}/api/stocks`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          "Erreur lors de l'enregistrement du stock."
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
          `Stock enregistré : ${quantiteNumerique} ${typeEntree} = ${quantiteEnUnites.toLocaleString()} unité(s).`
      });

      /*
       * RESET
       */

      setNomNouvelArticle('');

      setQuantiteStockEntrante('');

      setTypeEntree('Pièce');

      setSeuilAlerte('5');

      setMultiplicateurDetail('1');

      setMultiplicateurGros('1');

      setPrixVenteGros('');

      setPrixVenteDetail('');

      setPrixVenteUnite('');

      setArticleExistant(null);

      /*
       * Rafraîchir les stocks
       */

      await chargerStocksDuSite();

      /*
       * Informer le parent
       */

      onStockAjoute?.(
        data.stock || data
      );

    } catch (error) {
      console.error(
        'Erreur enregistrement stock :',
        error
      );

      setMessage({
        type: 'error',
        text:
          error.message
      });

    } finally {
      setIsSubmitting(false);
    }
  }

  /*
   * =========================================================
   * PAS DE PERMISSION
   * =========================================================
   */

  if (
    !flags.stockGestion
  ) {
    return null;
  }

  const titre =
    flags.stockGestionGenerale
      ? 'Gestion du stock'
      : 'Gestion du stock papier';

  /*
   * =========================================================
   * AFFICHAGE
   * =========================================================
   */

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

      <h2 className="text-lg font-black text-gray-800">
        {titre}
      </h2>

      <p className="text-xs text-gray-400 mt-1 mb-5">
        {flags.stockGestionGenerale
          ? 'Enregistrez les entrées de stock et leur valeur.'
          : 'Vous pouvez uniquement enregistrer le stock de papier/rames.'}
      </p>

      {message.text && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm font-semibold ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={
          handleAjouterStock
        }
        className="space-y-4"
      >

        {/* ARTICLE */}

        <div>
          <input
            list="stocks-existants"
            value={
              nomNouvelArticle
            }
            onChange={e =>
              handleNomArticleChange(
                e.target.value
              )
            }
            className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
            placeholder="Nom de l’article"
            required
          />

          <datalist id="stocks-existants">
            {stocksExistants.map(
              stock => (
                <option
                  key={
                    stock._id
                  }
                  value={
                    stock.nom_article
                  }
                />
              )
            )}
          </datalist>
        </div>

        {/* QUANTITÉ + TYPE */}

        <div className="grid grid-cols-2 gap-3">

          <input
            type="number"
            min="1"
            step="1"
            value={
              quantiteStockEntrante
            }
            onChange={e =>
              setQuantiteStockEntrante(
                e.target.value
              )
            }
            className="p-3 rounded-xl border bg-gray-50 text-sm"
            placeholder="Quantité entrante"
            required
          />

          <select
            value={
              typeEntree
            }
            onChange={e =>
              setTypeEntree(
                e.target.value
              )
            }
            className="p-3 rounded-xl border bg-gray-50 text-sm"
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

        {/* CONVERSION */}

        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">

          <p className="text-xs font-bold text-blue-600 mb-1">
            Quantité réellement ajoutée au stock
          </p>

          <p className="text-lg font-black text-blue-800">
            {quantiteEnUnites.toLocaleString()}
            {' '}
            unité
            {quantiteEnUnites > 1
              ? 's'
              : ''}
          </p>

          {quantiteNumerique > 0 && (
            <p className="text-xs text-blue-500 mt-1">
              {quantiteNumerique}
              {' '}
              {typeEntree}
              {' × '}
              {multiplicateur}
              {' '}
              unité(s)
            </p>
          )}

        </div>

        {/* PRIX DE VENTE SELON LE TYPE D'ENTRÉE */}

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-3">

          <p className="text-xs font-bold text-amber-600">
            Prix de vente
            {typeEntree === 'Gros'
              ? ' (gros, détail et unité)'
              : typeEntree === 'Détail'
                ? " (détail et unité)"
                : " (unité uniquement)"}
          </p>

          {typeEntree === 'Gros' && (
            <input
              type="number"
              min="0"
              step="1"
              value={prixVenteGros}
              onChange={e =>
                setPrixVenteGros(
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border bg-white text-sm"
              placeholder="Prix de vente en gros (1 Gros)"
              required
            />
          )}

          {(typeEntree === 'Gros' ||
            typeEntree === 'Détail') && (
            <input
              type="number"
              min="0"
              step="1"
              value={prixVenteDetail}
              onChange={e =>
                setPrixVenteDetail(
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border bg-white text-sm"
              placeholder="Prix de vente à la détail (1 Détail)"
              required
            />
          )}

          <input
            type="number"
            min="0"
            step="1"
            value={prixVenteUnite}
            onChange={e =>
              setPrixVenteUnite(
                e.target.value
              )
            }
            className="w-full p-3 rounded-xl border bg-white text-sm"
            placeholder="Prix de vente à l'unité (1 Unité)"
            required
          />

        </div>

        {/* PRIX TOTAL AUTOMATIQUE */}

        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">

          <p className="text-xs font-bold text-emerald-600 mb-1">
            Prix total (calculé automatiquement)
          </p>

          <p className="text-lg font-black text-emerald-800">
            {prixTotalCalcule.toLocaleString(
              'fr-FR'
            )}{' '}
            FCFA
          </p>

          {quantiteNumerique > 0 && (
            <p className="text-xs text-emerald-500 mt-1">
              {quantiteNumerique}{' '}{typeEntree}
              {' × '}
              {prixUnitaireCalcul.toLocaleString(
                'fr-FR'
              )}{' '}
              FCFA
            </p>
          )}

        </div>

        {/* SEUIL */}

        <input
          type="number"
          min="0"
          step="1"
          value={
            seuilAlerte
          }
          onChange={e =>
            setSeuilAlerte(
              e.target.value
            )
          }
          className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
          placeholder="Seuil d’alerte en unités"
        />

        {/* MULTIPLICATEURS */}

        {!articleExistant && (
          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                1 Détail =
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={
                  multiplicateurDetail
                }
                onChange={e =>
                  setMultiplicateurDetail(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder="Unités"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                1 Gros =
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={
                  multiplicateurGros
                }
                onChange={e =>
                  setMultiplicateurGros(
                    e.target.value
                  )
                }
                className="w-full p-3 rounded-xl border bg-gray-50 text-sm"
                placeholder="Unités"
              />
            </div>

          </div>
        )}

        {articleExistant && (
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500">

            <div className="font-bold text-gray-700 mb-1">
              Configuration de l'article
            </div>

            <div>
              1 Détail =
              {' '}
              {articleExistant.multiplicateur_detail || 1}
              {' '}
              unité(s)
            </div>

            <div>
              1 Gros =
              {' '}
              {articleExistant.multiplicateur_gros || 1}
              {' '}
              unité(s)
            </div>

          </div>
        )}

        {/* BOUTON */}

        <button
          type="submit"
          disabled={
            isSubmitting
          }
          className="w-full p-3.5 rounded-xl bg-gray-900 text-white font-bold text-sm disabled:opacity-50"
        >
          {isSubmitting
            ? 'Enregistrement...'
            : 'Enregistrer le stock'}
        </button>

      </form>
    </div>
  );
}
