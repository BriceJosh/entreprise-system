const {
  PERMISSIONS,
  getPermissions,
  hasPermission,
  getServiceTypes,
  canDoService,
  isPaperStockItem
} = require('../config/permissions');

function estDirecteur(req) {
  return req.user?.role === 'directeur' || req.user?.role === 'admin';
}

function estSecretaire(req) {
  return req.user?.role === 'secretaire';
}

function aPermission(req, permission) {
  return estDirecteur(req) || hasPermission(
    req.user?.poste,
    req.user?.role,
    permission
  );
}

function peutFaireServices(req) {
  return aPermission(req, PERMISSIONS.ACTIVITE_SERVICE);
}

function peutFaireVente(req) {
  return aPermission(req, PERMISSIONS.VENTE);
}

function peutLireStock(req) {
  return aPermission(req, PERMISSIONS.STOCK_LECTURE) || aPermission(req, PERMISSIONS.STOCK_GESTION) || aPermission(req, PERMISSIONS.STOCK_PAPIER_GESTION);
}

function peutGererStock(req) {
  return aPermission(req, PERMISSIONS.STOCK_GESTION);
}

function peutGererStockPapier(req) {
  return aPermission(req, PERMISSIONS.STOCK_GESTION) || aPermission(req, PERMISSIONS.STOCK_PAPIER_GESTION);
}

function peutFaireDepense(req) {
  return aPermission(req, PERMISSIONS.DEPENSE);
}

function peutFaireDepotBanque(req) {
  return aPermission(req, PERMISSIONS.DEPOT_BANQUE);
}

function peutGererCredit(req) {
  return aPermission(req, PERMISSIONS.CREDIT_GESTION);
}

function peutVoirJournalPropre(req) {
  return aPermission(req, PERMISSIONS.JOURNAL_PROPRE);
}

function peutVoirCaissePropre(req) {
  return aPermission(req, PERMISSIONS.CAISSE_PROPRE);
}

function peutFaireServiceType(req, serviceType) {
  return estDirecteur(req) || canDoService(
    req.user?.poste,
    req.user?.role,
    serviceType
  );
}

function peutGererArticleStock(req, nomArticle) {
  if (estDirecteur(req)) return true;
  if (peutGererStock(req)) return true;

  return (
    aPermission(req, PERMISSIONS.STOCK_PAPIER_GESTION) &&
    isPaperStockItem(nomArticle)
  );
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!aPermission(req, permission)) {
      return res.status(403).json({
        message: `Accès refusé : permission « ${permission} » requise.`
      });
    }
    next();
  };
}

function requireServices(req, res, next) {
  if (!peutFaireServices(req)) {
    return res.status(403).json({
      message: "Vous n'êtes pas autorisé à enregistrer des services."
    });
  }
  next();
}

function requireVente(req, res, next) {
  if (!peutFaireVente(req)) {
    return res.status(403).json({
      message: "Vous n'êtes pas autorisé à enregistrer des ventes."
    });
  }
  next();
}

function requireStockLecture(req, res, next) {
  if (!peutLireStock(req)) {
    return res.status(403).json({
      message: "Vous n'êtes pas autorisé à consulter les stocks."
    });
  }
  next();
}

function requireStockGestion(req, res, next) {
  if (!peutGererStock(req) && !aPermission(req, PERMISSIONS.STOCK_PAPIER_GESTION)) {
    return res.status(403).json({
      message: "Vous n'êtes pas autorisé à gérer les stocks."
    });
  }
  next();
}

function requireDepense(req, res, next) {
  if (!peutFaireDepense(req)) {
    return res.status(403).json({
      message: "Vous n'êtes pas autorisé à enregistrer des dépenses."
    });
  }
  next();
}

module.exports = {
  PERMISSIONS,
  getPermissions,
  getServiceTypes,
  estDirecteur,
  estSecretaire,
  aPermission,
  peutFaireServices,
  peutFaireVente,
  peutLireStock,
  peutGererStock,
  peutGererStockPapier,
  peutGererArticleStock,
  peutFaireDepense,
  peutFaireDepotBanque,
  peutGererCredit,
  peutVoirJournalPropre,
  peutVoirCaissePropre,
  peutFaireServiceType,
  requirePermission,
  requireServices,
  requireVente,
  requireStockLecture,
  requireStockGestion,
  requireDepense
};
