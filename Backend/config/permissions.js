const PERMISSIONS = Object.freeze({
  ACTIVITE_SERVICE: 'activite_service',
  VENTE: 'vente',
  STOCK_LECTURE: 'stock_lecture',
  STOCK_GESTION: 'stock_gestion',
  STOCK_PAPIER_GESTION: 'stock_papier_gestion',
  DEPENSE: 'depense',
  DEPOT_BANQUE: 'depot_banque',
  CREDIT_GESTION: 'credit_gestion',
  JOURNAL_PROPRE: 'journal_propre',
  CAISSE_PROPRE: 'caisse_propre'
});

const SERVICE_TYPES = Object.freeze({
  IMPRESSION_PAPIER: 'impression_papier',
  PHOTOCOPIE: 'photocopie',
  SAISIE: 'saisie',
  PLASTIFICATION: 'plastification',
  IMPRESSION_BACHE: 'impression_bache',
  IMPRESSION_AUTOCOLLANT: 'impression_autocollant',
  IMPRESSION_DTF: 'impression_dtf',
  AUTRE_SERVICE: 'autre_service'
});

const ROLE_PERMISSIONS = Object.freeze({
  services: [
    PERMISSIONS.ACTIVITE_SERVICE,
    PERMISSIONS.DEPENSE,
    PERMISSIONS.DEPOT_BANQUE,
    PERMISSIONS.CREDIT_GESTION,
    PERMISSIONS.JOURNAL_PROPRE,
    PERMISSIONS.CAISSE_PROPRE
  ],
  secretaire_1: [
    PERMISSIONS.ACTIVITE_SERVICE,
    PERMISSIONS.DEPENSE,
    PERMISSIONS.DEPOT_BANQUE,
    PERMISSIONS.CREDIT_GESTION,
    PERMISSIONS.JOURNAL_PROPRE,
    PERMISSIONS.CAISSE_PROPRE
  ],
  secretaire_2: [
    PERMISSIONS.ACTIVITE_SERVICE,
    PERMISSIONS.DEPENSE,
    PERMISSIONS.DEPOT_BANQUE,
    PERMISSIONS.CREDIT_GESTION,
    PERMISSIONS.JOURNAL_PROPRE,
    PERMISSIONS.CAISSE_PROPRE
  ],
  secretaire_3: [
    PERMISSIONS.VENTE,
    PERMISSIONS.STOCK_LECTURE,
    PERMISSIONS.STOCK_GESTION,
    PERMISSIONS.DEPENSE,
    PERMISSIONS.DEPOT_BANQUE,
    PERMISSIONS.CREDIT_GESTION,
    PERMISSIONS.JOURNAL_PROPRE,
    PERMISSIONS.CAISSE_PROPRE
  ],
  secretaire_4: [
    PERMISSIONS.ACTIVITE_SERVICE,
    PERMISSIONS.VENTE,
    PERMISSIONS.STOCK_LECTURE,
    PERMISSIONS.STOCK_PAPIER_GESTION,
    PERMISSIONS.DEPENSE,
    PERMISSIONS.DEPOT_BANQUE,
    PERMISSIONS.CREDIT_GESTION,
    PERMISSIONS.JOURNAL_PROPRE,
    PERMISSIONS.CAISSE_PROPRE
  ],
  polyvalent: Object.values(PERMISSIONS)
});

const ROLE_SERVICES = Object.freeze({
  services: Object.values(SERVICE_TYPES),
  secretaire_1: [
    SERVICE_TYPES.IMPRESSION_BACHE,
    SERVICE_TYPES.IMPRESSION_AUTOCOLLANT,
    SERVICE_TYPES.IMPRESSION_DTF,
    SERVICE_TYPES.AUTRE_SERVICE
  ],
  secretaire_2: [
    SERVICE_TYPES.IMPRESSION_PAPIER,
    SERVICE_TYPES.PHOTOCOPIE,
    SERVICE_TYPES.SAISIE,
    SERVICE_TYPES.PLASTIFICATION,
    SERVICE_TYPES.AUTRE_SERVICE
  ],
  secretaire_4: [
    SERVICE_TYPES.IMPRESSION_PAPIER,
    SERVICE_TYPES.AUTRE_SERVICE
  ],
  polyvalent: Object.values(SERVICE_TYPES)
});

function normalizePoste(poste) {
  return String(poste || 'services').trim().toLowerCase();
}

function getPermissions(poste, role) {
  if (role === 'directeur' || role === 'admin') {
    return Object.values(PERMISSIONS);
  }

  return ROLE_PERMISSIONS[normalizePoste(poste)] || [];
}

function hasPermission(poste, role, permission) {
  return getPermissions(poste, role).includes(permission);
}

function getServiceTypes(poste, role) {
  if (role === 'directeur' || role === 'admin') {
    return Object.values(SERVICE_TYPES);
  }

  return ROLE_SERVICES[normalizePoste(poste)] || [];
}

function normalizeServiceType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function canDoService(poste, role, serviceType) {
  if (!hasPermission(poste, role, PERMISSIONS.ACTIVITE_SERVICE)) {
    return false;
  }

  const normalized = normalizeServiceType(serviceType);
  return getServiceTypes(poste, role).includes(normalized);
}

function isPaperStockItem(name) {
  const value = normalizeServiceType(name);
  return /(papier|ramette|rame|feuille|a4|a3)/i.test(value);
}

module.exports = {
  PERMISSIONS,
  SERVICE_TYPES,
  ROLE_PERMISSIONS,
  ROLE_SERVICES,
  getPermissions,
  hasPermission,
  getServiceTypes,
  normalizeServiceType,
  canDoService,
  isPaperStockItem
};
