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

  const [prixVente, setPrixVente] =
    useState('');

  const [prixTotal, setPrixTotal] =
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

      if (
        article.prix_vente !==
        undefined
      ) {
        setPrixVente(
          String(
            article.prix_vente
          )
        );
      } else if (
        article.prix_vente_unite !==
        undefined
      ) {
        setPrixVente(
          String(
            article.prix_vente_unite
          )
        );
      }

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

    const prixVenteNumerique =
      Number(prixVente);

    if (
      !Number.isFinite(
        prixVenteNumerique
      ) ||
      prixVenteNumerique < 0
    ) {
      setMessage({
        type: 'error',
        text:
          'Veuillez saisir un prix de vente valide.'
      });

      return;
    }

    const prixTotalNumerique =
      Number(prixTotal);

    if (
      !Number.isFinite(
        prixTotalNumerique
      ) ||
      prixTotalNumerique < 0
    ) {
      setMessage({
        type: 'error',
        text:
          'Veuillez saisir un prix total valide.'
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

        prix_vente:
          prixVenteNumerique,

        prix_total:
          prixTotalNumerique,

        site_id:
          siteId
      };

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

      setPrixVente('');

      setPrixTotal('');

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

        {/* PRIX */}

        <div className="grid grid-cols-2 gap-3">

          <input
            type="number"
            min="0"
            step="1"
            value={
              prixVente
            }
            onChange={e =>
              setPrixVente(
                e.target.value
              )
            }
            className="p-3 rounded-xl border bg-gray-50 text-sm"
            placeholder="Prix de vente"
            required
          />

          <input
            type="number"
            min="0"
            step="1"
            value={
              prixTotal
            }
            onChange={e =>
              setPrixTotal(
                e.target.value
              )
            }
            className="p-3 rounded-xl border bg-gray-50 text-sm"
            placeholder="Prix total de la quantité"
            required
          />

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
