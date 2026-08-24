const mongoose = require("mongoose");

/*
 * =========================================================
 * REÇU CLIENT
 * =========================================================
 *
 * Un reçu regroupe UNE OU PLUSIEURS lignes de vente
 * réalisées lors d'un même passage du client.
 *
 * Exemples :
 *
 * - Client achète 1 seul article
 *   → 1 reçu avec 1 ligne
 *
 * - Client achète 3 articles différents
 *   → 1 reçu avec 3 lignes
 *
 * Les activités (ventes) correspondantes sont liées au
 * reçu via le champ recu_id.
 * =========================================================
 */

const recuSchema = new mongoose.Schema(
  {
    /*
     * =======================================================
     * NUMÉRO DE REÇU LISIBLE
     * =======================================================
     *
     * Format : REC-000001
     */

    numero: {
      type: String,
      unique: true,
    },

    /*
     * =======================================================
     * LIGNES DU REÇU
     * =======================================================
     *
     * Copie figée des ventes au moment de l'impression.
     */

    lignes: [
      {
        activite_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Activite",
        },

        designation: {
          type: String,
          required: true,
        },

        quantite: {
          type: Number,
          required: true,
          min: 1,
        },

        option_vente: {
          type: String,
          enum: ["Pièce", "Détail", "Gros"],
          default: "Pièce",
        },

        prix_unitaire: {
          type: Number,
          required: true,
          min: 0,
        },

        montant: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    /*
     * =======================================================
     * MONTANT TOTAL DU REÇU
     * =======================================================
     */

    montant_total: {
      type: Number,
      required: true,
      min: [0, "Le montant total ne peut pas être négatif"],
    },

    /*
     * =======================================================
     * MONTANT PAYÉ / MONNAIE RENDUE (facultatifs)
     * =======================================================
     */

    montant_paye: {
      type: Number,
      default: null,
      min: 0,
    },

    monnaie_rendue: {
      type: Number,
      default: null,
      min: 0,
    },

    /*
     * =======================================================
     * NOM DU CLIENT (facultatif)
     * =======================================================
     */

    nom_client: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * =======================================================
     * NOM DE LA PERSONNE QUI A SERVI (facultatif)
     * =======================================================
     *
     * Saisi librement au moment de la vente.
     * Si vide, le reçu affiche le nom du compte utilisé.
     */

    servi_par: {
      type: String,
      trim: true,
      default: "",
    },

    /*
     * =======================================================
     * SITE ET UTILISATEUR
     * =======================================================
     */

    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: [true, "Le site est obligatoire"],
    },

    /*
     * =======================================================
     * COPIE FIGÉE DES INFOS DU SITE
     * =======================================================
     *
     * Nom et numéro de téléphone du site copiés au moment
     * de la création : les anciens reçus gardent le bon
     * numéro même si celui de l'agence change plus tard.
     */

    site_nom: {
      type: String,
      trim: true,
      default: "",
    },

    site_telephone: {
      type: String,
      trim: true,
      default: "",
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "L'utilisateur est obligatoire"],
    },
  },
  {
    timestamps: true,
  },
);

/*
 * =========================================================
 * INDEX
 * =========================================================
 */

recuSchema.index({
  site_id: 1,
  createdAt: -1,
});

recuSchema.index({
  user_id: 1,
  createdAt: -1,
});

/*
 * =========================================================
 * GÉNÉRATION AUTOMATIQUE DU NUMÉRO DE REÇU
 * =========================================================
 *
 * Format : REC-AAAA-000001
 *
 * Le compteur est basé sur le nombre de reçus du site
 * pour l'année en cours.
 */

recuSchema.pre("validate", async function () {
  if (this.numero) {
    return;
  }

  const Recu = mongoose.model("Recu");

  const annee = new Date().getFullYear();

  const compteur = await Recu.countDocuments({
    site_id: this.site_id,
    createdAt: {
      $gte: new Date(`${annee}-01-01T00:00:00.000Z`),
      $lte: new Date(`${annee}-12-31T23:59:59.999Z`),
    },
  });

  this.numero = `REC-${annee}-${String(compteur + 1).padStart(6, "0")}`;
});

module.exports = mongoose.model("Recu", recuSchema);
