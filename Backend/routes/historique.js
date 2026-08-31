const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit-table");

const Activite = require("../models/Activite");
const Depense = require("../models/Depense");
const StockMouvement = require("../models/StockMouvement");
const DepotBanque = require("../models/DepotBanque");
const Credit = require("../models/Credit");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  estDirecteur,
  peutVoirJournalPropre,
} = require("../middleware/permissions");

const TYPES = new Set([
  "stock",
  "vente",
  "service",
  "depense",
  "depot",
  "credit",
  "paiement_credit",
]);

function getUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || req.user?._id;
}

function getSiteId(req) {
  return req.user?.site_id?._id || req.user?.site_id || req.user?.site?._id;
}

function parseDate(value, finDeJournee = false) {
  if (!value) return null;
  const date = new Date(
    `${value}T${finDeJournee ? "23:59:59.999" : "00:00:00.000"}`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function id(value) {
  return value?._id || value || null;
}

function utilisateur(value) {
  if (!value) return null;
  return {
    _id: id(value),
    nom: value.username || value.nom || "Utilisateur",
  };
}

function site(value) {
  if (!value) return null;
  return {
    _id: id(value),
    nom: value.nom || "Site",
  };
}

function dansPeriode(date, debut, fin) {
  const valeur = new Date(date);
  if (Number.isNaN(valeur.getTime())) return false;
  return (!debut || valeur >= debut) && (!fin || valeur <= fin);
}

function libelleType(type) {
  const labels = {
    stock: "Stock",
    vente: "Vente",
    service: "Service",
    depense: "Dépense",
    depot: "Dépôt bancaire",
    credit: "Crédit fournisseur",
    paiement_credit: "Paiement crédit",
  };
  return labels[type] || type;
}

function quantiteOperation(operation) {
  if (operation.quantite === null || operation.quantite === undefined) {
    return "-";
  }
  return `${operation.quantite}${operation.option_quantite ? ` ${operation.option_quantite}` : ""}`;
}

function dateEtHeure(date) {
  const valeur = new Date(date);
  return {
    date: valeur.toLocaleDateString("fr-FR"),
    heure: valeur.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

async function exporterExcel(res, operations, filtres) {
  const workbook = new ExcelJS.Workbook();
  const feuille = workbook.addWorksheet("Historique");

  feuille.mergeCells("A1:K1");
  feuille.getCell("A1").value = "HISTORIQUE DES OPÉRATIONS";
  feuille.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  feuille.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  feuille.getCell("A1").alignment = { horizontal: "center" };
  feuille.mergeCells("A2:K2");
  feuille.getCell("A2").value =
    `Période : ${filtres.date_debut || "Début"} au ${filtres.date_fin || "Aujourd'hui"} | Type : ${libelleType(filtres.type)}`;

  feuille.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Heure", key: "heure", width: 10 },
    { header: "Type", key: "type", width: 20 },
    { header: "Site", key: "site", width: 18 },
    { header: "Agent", key: "agent", width: 20 },
    { header: "Désignation", key: "designation", width: 28 },
    { header: "Quantité", key: "quantite", width: 16 },
    { header: "Prix unitaire", key: "prix", width: 15 },
    { header: "Montant", key: "montant", width: 16 },
    { header: "Sens", key: "sens", width: 13 },
    { header: "Détails", key: "details", width: 30 },
  ];

  const headerRow = feuille.getRow(3);
  headerRow.values = feuille.columns.map((colonne) => colonne.header);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };

  operations.forEach((operation) => {
    const date = dateEtHeure(operation.date);
    const row = feuille.addRow({
      date: date.date,
      heure: date.heure,
      type: libelleType(operation.type),
      site: operation.site?.nom || "-",
      agent: operation.utilisateur?.nom || "-",
      designation: operation.designation || "-",
      quantite: quantiteOperation(operation),
      prix: Number(operation.prix_unitaire) || 0,
      montant: Number(operation.montant) || 0,
      sens: operation.sens || "-",
      details: operation.description || "-",
    });
    row.getCell("prix").numFmt = '#,##0 "FCFA"';
    row.getCell("montant").numFmt = '#,##0 "FCFA"';
  });

  feuille.views = [{ state: "frozen", ySplit: 3 }];
  feuille.autoFilter = "A3:K3";

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Historique_operations.xlsx"',
  );
  await workbook.xlsx.write(res);
  res.end();
}

async function exporterPdf(res, operations, filtres) {
  const document = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 24,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Historique_operations.pdf"',
  );
  document.pipe(res);

  document
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("HISTORIQUE DES OPÉRATIONS", { align: "center" });
  document.moveDown(0.3);
  document
    .font("Helvetica")
    .fontSize(8)
    .text(
      `Période : ${filtres.date_debut || "Début"} au ${filtres.date_fin || "Aujourd'hui"} | Type : ${libelleType(filtres.type)} | Site : ${filtres.site_id || "TOUS"}`,
    );
  document.moveDown(0.8);

  const rows = operations.map((operation) => {
    const date = dateEtHeure(operation.date);
    const prixUnit = Number(operation.prix_unitaire) || 0;
    const prixUnitStr =
      prixUnit > 0 ? `${prixUnit.toLocaleString("fr-FR")} FCFA` : "-";
    return [
      date.date,
      date.heure,
      libelleType(operation.type),
      operation.site?.nom || "-",
      operation.designation || "-",
      quantiteOperation(operation),
      prixUnitStr,
      `${(Number(operation.montant) || 0).toLocaleString("fr-FR")} FCFA`,
    ];
  });

  await document.table(
    {
      headers: [
        "Date",
        "Heure",
        "Type",
        "Site",
        "Désignation",
        "Qté",
        "Prix Unitaire",
        "Montant Total",
      ],
      rows,
    },
    {
      prepareHeader: () => document.font("Helvetica-Bold").fontSize(7),
      prepareRow: () => document.font("Helvetica").fontSize(6.5),
    },
  );

  document.end();
}

/**
 * GET /api/historique
 *
 * Query parameters:
 * - date_debut=YYYY-MM-DD
 * - date_fin=YYYY-MM-DD
 * - type=tous|stock|vente|service|depense|depot|credit|paiement_credit
 * - site_id=<ObjectId> (direction uniquement)
 * - limite=1..5000 (1000 par défaut)
 */
async function afficherHistorique(req, res) {
  try {
    if (!estDirecteur(req) && !peutVoirJournalPropre(req)) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à consulter l'historique.",
      });
    }

    const debut = parseDate(req.query.date_debut);
    const fin = parseDate(req.query.date_fin, true);
    if (debut === undefined || fin === undefined) {
      return res
        .status(400)
        .json({ message: "Format de date invalide. Utilisez YYYY-MM-DD." });
    }
    if (debut && fin && debut > fin) {
      return res
        .status(400)
        .json({ message: "La date de début doit précéder la date de fin." });
    }

    const typeDemande = String(req.query.type || "tous")
      .trim()
      .toLowerCase();
    if (typeDemande !== "tous" && !TYPES.has(typeDemande)) {
      return res.status(400).json({ message: "Type de filtre invalide." });
    }

    const filtreCommun = {};
    if (estDirecteur(req)) {
      const siteDemande = req.query.site_id;
      if (
        siteDemande &&
        siteDemande !== "TOUS" &&
        siteDemande !== "tous" &&
        siteDemande !== "null" &&
        siteDemande !== "undefined"
      ) {
        filtreCommun.site_id = siteDemande;
      }

      const userDemande = req.query.user_id || req.query.secretaire_id;
      if (
        userDemande &&
        userDemande !== "TOUS" &&
        userDemande !== "tous" &&
        userDemande !== "null" &&
        userDemande !== "undefined"
      ) {
        filtreCommun.user_id = userDemande;
      }
    } else {
      const siteId = getSiteId(req);
      const userId = getUserId(req);
      if (!siteId || !userId) {
        return res
          .status(403)
          .json({ message: "Votre compte doit être rattaché à un site." });
      }
      filtreCommun.site_id = siteId;
      filtreCommun.user_id = userId;
    }

    const formatExport = req.params?.format;
    if (formatExport && !["excel", "pdf"].includes(formatExport)) {
      return res
        .status(400)
        .json({ message: "Format d'export invalide. Utilisez excel ou pdf." });
    }

    const limiteParDefaut = formatExport ? 5000 : 1000;
    const limite = Math.min(
      Math.max(Number(req.query.limite) || limiteParDefaut, 1),
      5000,
    );
    const besoin = (type) => typeDemande === "tous" || typeDemande === type;

    const requetes = [
      besoin("stock")
        ? StockMouvement.find(filtreCommun)
            .populate("site_id", "nom ville")
            .populate("user_id", "username nom")
            .lean()
        : Promise.resolve([]),
      besoin("vente") || besoin("service")
        ? Activite.find({
            ...filtreCommun,
            type: { $in: ["vente", "impression"] },
          })
            .populate("site_id", "nom ville")
            .populate("user_id", "username nom")
            .lean()
        : Promise.resolve([]),
      besoin("depense")
        ? Depense.find(filtreCommun)
            .populate("site_id", "nom ville")
            .populate("user_id", "username nom")
            .lean()
        : Promise.resolve([]),
      besoin("depot")
        ? DepotBanque.find(filtreCommun)
            .populate("site_id", "nom ville")
            .populate("user_id", "username nom")
            .lean()
        : Promise.resolve([]),
      besoin("credit") || besoin("paiement_credit")
        ? Credit.find(filtreCommun)
            .populate("site_id", "nom ville")
            .populate("user_id", "username nom")
            .populate("paiements.user_id", "username nom")
            .lean()
        : Promise.resolve([]),
    ];

    const [mouvementsStock, activites, depenses, depots, credits] =
      await Promise.all(requetes);
    const operations = [];

    mouvementsStock.forEach((item) => {
      const date = item.createdAt;
      if (!dansPeriode(date, debut, fin)) return;
      const qte = item.quantite_entree ?? item.quantite_unites ?? 1;
      const prixVentUnit =
        Number(item.prix_vente_unitaire) ||
        (item.quantite_unites > 0
          ? Math.round((Number(item.prix_total) || 0) / item.quantite_unites)
          : 0);
      operations.push({
        _id: `stock:${item._id}`,
        source: "stock_mouvement",
        type: "stock",
        date,
        site: site(item.site_id),
        utilisateur: utilisateur(item.user_id),
        designation: item.nom_article,
        description: item.description || "",
        quantite: qte,
        option_quantite: item.type_entree || "Pièce",
        quantite_unites: item.quantite_unites,
        prix_unitaire: prixVentUnit,
        montant: Number(item.prix_total) || 0,
        sens: "stock",
      });
    });

    activites.forEach((item) => {
      const date = item.createdAt;
      const type = item.type === "vente" ? "vente" : "service";
      if (!dansPeriode(date, debut, fin) || !besoin(type)) return;
      operations.push({
        _id: `activite:${item._id}`,
        source: "activite",
        type,
        date,
        site: site(item.site_id),
        utilisateur: utilisateur(item.user_id),
        designation: item.designation || "Opération",
        description: item.description || "",
        quantite: item.quantite || 1,
        option_quantite: item.option_vente || null,
        quantite_unites: item.quantite_unites || item.quantite || 1,
        prix_unitaire: Number(item.prix_unitaire) || 0,
        montant: Number(item.montant_total) || 0,
        sens: "entree",
        longueur: item.longueur || null,
        largeur: item.largeur || null,
        surface_m2: item.surface_m2 || null,
        prix_m2: item.prix_m2 || null,
        avec_conception: Boolean(item.avec_conception),
        prix_conception: Number(item.prix_conception) || 0,
      });
    });

    depenses.forEach((item) => {
      const date = item.date || item.createdAt;
      if (!dansPeriode(date, debut, fin)) return;
      operations.push({
        _id: `depense:${item._id}`,
        source: "depense",
        type: "depense",
        date,
        site: site(item.site_id),
        utilisateur: utilisateur(item.user_id),
        designation: item.motif || "Dépense",
        description: "",
        quantite: null,
        prix_unitaire: 0,
        montant: Number(item.montant) || 0,
        sens: "depense",
      });
    });

    depots.forEach((item) => {
      const date = item.date_depot || item.createdAt;
      if (!dansPeriode(date, debut, fin)) return;
      operations.push({
        _id: `depot:${item._id}`,
        source: "depot_banque",
        type: "depot",
        date,
        site: site(item.site_id),
        utilisateur: utilisateur(item.user_id),
        designation: item.banque || "Dépôt bancaire",
        description: item.note || item.reference || "",
        quantite: null,
        montant: Number(item.montant) || 0,
        sens: "transfert",
      });
    });

    credits.forEach((item) => {
      if (
        besoin("credit") &&
        dansPeriode(item.date_achat || item.createdAt, debut, fin)
      ) {
        operations.push({
          _id: `credit:${item._id}`,
          source: "credit",
          type: "credit",
          date: item.date_achat || item.createdAt,
          site: site(item.site_id),
          utilisateur: utilisateur(item.user_id),
          designation: item.designation,
          description: `Fournisseur : ${item.fournisseur}${item.reference ? ` — ${item.reference}` : ""}`,
          quantite: null,
          montant: Number(item.montant_total) || 0,
          sens: "credit",
          statut_credit: item.statut,
          reste_a_payer: Number(item.reste_a_payer) || 0,
        });
      }

      if (besoin("paiement_credit") || typeDemande === "tous") {
        (item.paiements || []).forEach((paiement) => {
          const date = paiement.date_paiement || item.updatedAt;
          if (!dansPeriode(date, debut, fin)) return;
          if (
            filtreCommun.user_id &&
            String(paiement.user_id?._id || paiement.user_id) !==
              String(filtreCommun.user_id)
          ) {
            return;
          }
          operations.push({
            _id: `paiement_credit:${item._id}:${paiement._id}`,
            source: "credit",
            type: "paiement_credit",
            date,
            site: site(item.site_id),
            utilisateur: utilisateur(paiement.user_id),
            designation: `Paiement — ${item.designation}`,
            description: `Fournisseur : ${item.fournisseur}${paiement.reference ? ` — ${paiement.reference}` : ""}`,
            quantite: null,
            montant: Number(paiement.montant) || 0,
            sens: "sortie",
          });
        });
      }
    });

    operations.sort((a, b) => new Date(b.date) - new Date(a.date));
    const resultat = operations.slice(0, limite);

    const filtres = {
      date_debut: req.query.date_debut || null,
      date_fin: req.query.date_fin || null,
      type: typeDemande,
      site_id: filtreCommun.site_id ? String(filtreCommun.site_id) : "tous",
      user_id: filtreCommun.user_id ? String(filtreCommun.user_id) : "tous",
    };

    if (formatExport === "excel") {
      return exporterExcel(res, resultat, filtres);
    }
    if (formatExport === "pdf") {
      return exporterPdf(res, resultat, filtres);
    }

    res.json({
      filtres,
      total: resultat.length,
      operations: resultat,
    });
  } catch (error) {
    console.error("Erreur historique :", error);
    res.status(500).json({
      message: "Erreur lors de la récupération de l'historique.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

router.get("/", verifyToken, afficherHistorique);
router.get("/export/:format", verifyToken, afficherHistorique);

module.exports = router;
