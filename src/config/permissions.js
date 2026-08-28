export const PERMISSIONS = Object.freeze({
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

export const SERVICE_TYPES = Object.freeze({
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

export const SERVICE_LABELS = Object.freeze({
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

const ROLE_PERMISSIONS = {
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
};

export const ROLE_SERVICES = {
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
};

function getSiteMotif(site, email, username) {
  const str = `${site?.nom || ''} ${site?.ville || ''} ${email || ''} ${username || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (str.includes('adetikope')) return 'adetikope';
  if (str.includes('difakpota')) return 'difakpota';
  return 'tabligbo';
}

export function getPermissions(profil) {
  if (profil?.role === 'directeur' || profil?.role === 'admin') {
    return Object.values(PERMISSIONS);
  }

  if (Array.isArray(profil?.permissions) && profil.permissions.length > 0) {
    return profil.permissions;
  }

  const siteMotif = getSiteMotif(profil?.site_id || profil?.site, profil?.email, profil?.username);
  const p = String(profil?.poste || 'services').trim().toLowerCase();

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

  // 2. Secrétaire 1 Difakpota -> Services + Vente
  if (siteMotif === 'difakpota') {
    return [
      PERMISSIONS.ACTIVITE_SERVICE,
      PERMISSIONS.VENTE,
      PERMISSIONS.STOCK_LECTURE,
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

export function hasPermission(profil, permission) {
  return getPermissions(profil).includes(permission);
}

export function getServiceTypes(profil) {
  if (profil?.role === 'directeur' || profil?.role === 'admin') {
    return Object.values(SERVICE_TYPES);
  }

  if (Array.isArray(profil?.serviceTypes) && profil.serviceTypes.length > 0) {
    return profil.serviceTypes;
  }

  const siteMotif = getSiteMotif(profil?.site_id || profil?.site, profil?.email, profil?.username);
  const p = String(profil?.poste || 'services').trim().toLowerCase();

  // 1. Difakpota
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

  // 2. Adétikopé
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

  // 3. Tabligbo
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

export function canDoService(profil, serviceType) {
  return hasPermission(profil, PERMISSIONS.ACTIVITE_SERVICE) &&
    getServiceTypes(profil).includes(serviceType);
}

export function getPermissionFlags(profil) {
  return {
    services: hasPermission(profil, PERMISSIONS.ACTIVITE_SERVICE),
    vente: hasPermission(profil, PERMISSIONS.VENTE),
    stockLecture: hasPermission(profil, PERMISSIONS.STOCK_LECTURE) ||
      hasPermission(profil, PERMISSIONS.STOCK_GESTION) ||
      hasPermission(profil, PERMISSIONS.STOCK_PAPIER_GESTION),
    stockGestion: hasPermission(profil, PERMISSIONS.STOCK_GESTION) ||
      hasPermission(profil, PERMISSIONS.STOCK_PAPIER_GESTION),
    stockGestionGenerale: hasPermission(profil, PERMISSIONS.STOCK_GESTION),
    stockPapier: hasPermission(profil, PERMISSIONS.STOCK_PAPIER_GESTION),
    depense: hasPermission(profil, PERMISSIONS.DEPENSE),
    journal: hasPermission(profil, PERMISSIONS.JOURNAL_PROPRE),
    caisse: hasPermission(profil, PERMISSIONS.CAISSE_PROPRE)
  };
}
