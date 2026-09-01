const PERMISSIONS = Object.freeze({
  ACTIVITE_SERVICE: 'activite_service',
  VENTE: 'vente',
  STOCK_LECTURE: 'stock_lecture',
  STOCK_GESTION: 'stock_gestion',
  STOCK_PAPIER_GESTION: 'stock_papier_gestion',
  DECOUPAGE: 'decoupage',
  DEPENSE: 'depense',
  DEPOT_BANQUE: 'depot_banque',
  CREDIT_GESTION: 'credit_gestion',
  JOURNAL_PROPRE: 'journal_propre',
  CAISSE_PROPRE: 'caisse_propre'
});

const SERVICE_TYPES = Object.freeze({
  IMPRESSION_PAPIER_BLANC_NOIR: 'impression_papier_blanc_noir',
  IMPRESSION_PAPIER_COULEUR: 'impression_papier_couleur',
  PHOTOCOPIE: 'photocopie',
  SAISIE: 'saisie',
  PLASTIFICATION: 'plastification',
  IMPRESSION_BACHE: 'impression_bache',
  IMPRESSION_AUTOCOLLANT: 'impression_autocollant',
  IMPRESSION_DTF: 'impression_dtf',
  MAINTENANCE: 'maintenance',
  SCANNER: 'scanner',
  AUTRE_SERVICE: 'autre_service'
});

const SERVICE_LABELS = Object.freeze({
  impression_papier_blanc_noir: 'Impression papier blanc noir',
  impression_papier_couleur: 'Impression papier couleur',
  photocopie: 'Photocopie',
  saisie: 'Saisie',
  plastification: 'Plastification',
  impression_bache: 'Impression bâche',
  impression_autocollant: 'Impression Autocollant',
  impression_dtf: 'Impression DTF',
  maintenance: 'Maintenance',
  scanner: 'Scanner',
  autre_service: 'Autre service'
});

const ROLE_PERMISSIONS = Object.freeze({
  services: [
    PERMISSIONS.ACTIVITE_SERVICE,
    PERMISSIONS.VENTE,
    PERMISSIONS.STOCK_LECTURE,
    PERMISSIONS.DEPENSE,
    PERMISSIONS.DEPOT_BANQUE,
    PERMISSIONS.CREDIT_GESTION,
    PERMISSIONS.JOURNAL_PROPRE,
    PERMISSIONS.CAISSE_PROPRE
  ],
  secretaire_1: [
    PERMISSIONS.ACTIVITE_SERVICE,
    PERMISSIONS.VENTE,
    PERMISSIONS.STOCK_LECTURE,
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
    PERMISSIONS.ACTIVITE_SERVICE,
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
    SERVICE_TYPES.PHOTOCOPIE,
    SERVICE_TYPES.IMPRESSION_BACHE,
    SERVICE_TYPES.IMPRESSION_AUTOCOLLANT,
    SERVICE_TYPES.IMPRESSION_DTF,
    SERVICE_TYPES.AUTRE_SERVICE
  ],
  secretaire_2: [
    SERVICE_TYPES.IMPRESSION_PAPIER_BLANC_NOIR,
    SERVICE_TYPES.IMPRESSION_PAPIER_COULEUR,
    SERVICE_TYPES.PHOTOCOPIE,
    SERVICE_TYPES.SAISIE,
    SERVICE_TYPES.PLASTIFICATION,
    SERVICE_TYPES.MAINTENANCE,
    SERVICE_TYPES.SCANNER,
    SERVICE_TYPES.AUTRE_SERVICE
  ],
  secretaire_4: [
    SERVICE_TYPES.IMPRESSION_PAPIER_BLANC_NOIR,
    SERVICE_TYPES.IMPRESSION_PAPIER_COULEUR,
    SERVICE_TYPES.AUTRE_SERVICE
  ],
  polyvalent: Object.values(SERVICE_TYPES)
});

function normalizePoste(poste) {
  return String(poste || 'services').trim().toLowerCase();
}

function getSiteMotif(site, email, username) {
  const str = `${site?.nom || ''} ${site?.ville || ''} ${email || ''} ${username || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (str.includes('adetikope')) return 'adetikope';
  if (str.includes('difakpota')) return 'difakpota';
  return 'tabligbo';
}

function getPermissions(userOrPoste, maybeRole, maybeSite, maybeEmail) {
  let poste, role, site, email, username;

  if (typeof userOrPoste === 'object' && userOrPoste !== null) {
    poste = userOrPoste.poste;
    role = userOrPoste.role;
    site = userOrPoste.site_id || userOrPoste.site;
    email = userOrPoste.email;
    username = userOrPoste.username;
  } else {
    poste = userOrPoste;
    role = maybeRole;
    site = maybeSite;
    email = maybeEmail;
  }

  if (role === 'directeur' || role === 'admin') {
    return Object.values(PERMISSIONS);
  }

  const siteMotif = getSiteMotif(site, email, username);
  const p = normalizePoste(poste);

  // 1. Secrétaire 1 Adétikopé -> SERVICES uniquement (PAS de vente, PAS de stock)
  if (siteMotif === 'adetikope') {
    return [
      PERMISSIONS.ACTIVITE_SERVICE,
      PERMISSIONS.DEPENSE,
      PERMISSIONS.DEPOT_BANQUE,
      PERMISSIONS.CREDIT_GESTION,
      PERMISSIONS.JOURNAL_PROPRE,
      PERMISSIONS.CAISSE_PROPRE
    ];
  }

  // 2. Secrétaire 1 Difakpota -> Services + Vente + Découpage
  if (siteMotif === 'difakpota') {
    return [
      PERMISSIONS.ACTIVITE_SERVICE,
      PERMISSIONS.VENTE,
      PERMISSIONS.STOCK_LECTURE,
      PERMISSIONS.DECOUPAGE,
      PERMISSIONS.DEPENSE,
      PERMISSIONS.DEPOT_BANQUE,
      PERMISSIONS.CREDIT_GESTION,
      PERMISSIONS.JOURNAL_PROPRE,
      PERMISSIONS.CAISSE_PROPRE
    ];
  }

  // 3. Secrétariats Tabligbo
  if (p === 'secretaire_1') {
    // Secrétaire 1 Tabligbo -> SERVICES uniquement (AUCUN accès vente ni stock)
    return [
      PERMISSIONS.ACTIVITE_SERVICE,
      PERMISSIONS.DEPENSE,
      PERMISSIONS.DEPOT_BANQUE,
      PERMISSIONS.CREDIT_GESTION,
      PERMISSIONS.JOURNAL_PROPRE,
      PERMISSIONS.CAISSE_PROPRE
    ];
  }

  if (p === 'secretaire_2') {
    // Secrétaire 2 Tabligbo -> SERVICES uniquement
    return [
      PERMISSIONS.ACTIVITE_SERVICE,
      PERMISSIONS.DEPENSE,
      PERMISSIONS.DEPOT_BANQUE,
      PERMISSIONS.CREDIT_GESTION,
      PERMISSIONS.JOURNAL_PROPRE,
      PERMISSIONS.CAISSE_PROPRE
    ];
  }

  if (p === 'secretaire_3') {
    // Secrétaire 3 Tabligbo -> VENTES & STOCKS uniquement (AUCUN service)
    return [
      PERMISSIONS.VENTE,
      PERMISSIONS.STOCK_LECTURE,
      PERMISSIONS.STOCK_GESTION,
      PERMISSIONS.DEPENSE,
      PERMISSIONS.DEPOT_BANQUE,
      PERMISSIONS.CREDIT_GESTION,
      PERMISSIONS.JOURNAL_PROPRE,
      PERMISSIONS.CAISSE_PROPRE
    ];
  }

  if (p === 'secretaire_4') {
    // Secrétaire 4 Tabligbo -> Papier
    return [
      PERMISSIONS.ACTIVITE_SERVICE,
      PERMISSIONS.VENTE,
      PERMISSIONS.STOCK_LECTURE,
      PERMISSIONS.STOCK_PAPIER_GESTION,
      PERMISSIONS.DEPENSE,
      PERMISSIONS.DEPOT_BANQUE,
      PERMISSIONS.CREDIT_GESTION,
      PERMISSIONS.JOURNAL_PROPRE,
      PERMISSIONS.CAISSE_PROPRE
    ];
  }

  return ROLE_PERMISSIONS[p] || [];
}

function hasPermission(userOrPoste, maybeRole, maybePermission) {
  let permission;
  if (typeof userOrPoste === 'object' && userOrPoste !== null) {
    permission = maybeRole;
    return getPermissions(userOrPoste).includes(permission);
  }
  permission = maybePermission;
  return getPermissions(userOrPoste, maybeRole).includes(permission);
}

function getServiceTypes(userOrPoste, maybeRole, maybeSite, maybeEmail) {
  let poste, role, site, email, username;

  if (typeof userOrPoste === 'object' && userOrPoste !== null) {
    poste = userOrPoste.poste;
    role = userOrPoste.role;
    site = userOrPoste.site_id || userOrPoste.site;
    email = userOrPoste.email;
    username = userOrPoste.username;
  } else {
    poste = userOrPoste;
    role = maybeRole;
    site = maybeSite;
    email = maybeEmail;
  }

  if (role === 'directeur' || role === 'admin') {
    return Object.values(SERVICE_TYPES);
  }

  const siteMotif = getSiteMotif(site, email, username);
  const p = normalizePoste(poste);

  // 1. Secrétaire 1 Difakpota
  if (siteMotif === 'difakpota') {
    return [
      SERVICE_TYPES.PHOTOCOPIE,
      SERVICE_TYPES.IMPRESSION_PAPIER_BLANC_NOIR,
      SERVICE_TYPES.IMPRESSION_PAPIER_COULEUR,
      SERVICE_TYPES.IMPRESSION_BACHE,
      SERVICE_TYPES.IMPRESSION_AUTOCOLLANT,
      SERVICE_TYPES.AUTRE_SERVICE
    ];
  }

  // 2. Secrétaire 1 Adétikopé
  if (siteMotif === 'adetikope') {
    return [
      SERVICE_TYPES.PHOTOCOPIE,
      SERVICE_TYPES.IMPRESSION_PAPIER_BLANC_NOIR,
      SERVICE_TYPES.IMPRESSION_PAPIER_COULEUR,
      SERVICE_TYPES.IMPRESSION_BACHE,
      SERVICE_TYPES.IMPRESSION_AUTOCOLLANT,
      SERVICE_TYPES.IMPRESSION_DTF,
      SERVICE_TYPES.AUTRE_SERVICE
    ];
  }

  // 3. Secrétariats Tabligbo
  if (p === 'secretaire_1') {
    return [
      SERVICE_TYPES.PHOTOCOPIE,
      SERVICE_TYPES.IMPRESSION_BACHE,
      SERVICE_TYPES.IMPRESSION_AUTOCOLLANT,
      SERVICE_TYPES.AUTRE_SERVICE
    ];
  }

  if (p === 'secretaire_2') {
    return [
      SERVICE_TYPES.IMPRESSION_PAPIER_BLANC_NOIR,
      SERVICE_TYPES.IMPRESSION_PAPIER_COULEUR,
      SERVICE_TYPES.PHOTOCOPIE,
      SERVICE_TYPES.SAISIE,
      SERVICE_TYPES.PLASTIFICATION,
      SERVICE_TYPES.MAINTENANCE,
      SERVICE_TYPES.SCANNER,
      SERVICE_TYPES.AUTRE_SERVICE
    ];
  }

  if (p === 'secretaire_3') {
    return [];
  }

  if (p === 'secretaire_4') {
    return [
      SERVICE_TYPES.IMPRESSION_PAPIER_BLANC_NOIR,
      SERVICE_TYPES.IMPRESSION_PAPIER_COULEUR,
      SERVICE_TYPES.AUTRE_SERVICE
    ];
  }

  return Object.values(SERVICE_TYPES);
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
  SERVICE_LABELS,
  ROLE_PERMISSIONS,
  ROLE_SERVICES,
  getPermissions,
  hasPermission,
  getServiceTypes,
  normalizeServiceType,
  canDoService,
  isPaperStockItem
};
