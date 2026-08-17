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
  IMPRESSION_PAPIER: 'impression_papier',
  PHOTOCOPIE: 'photocopie',
  SAISIE: 'saisie',
  PLASTIFICATION: 'plastification',
  IMPRESSION_BACHE: 'impression_bache',
  IMPRESSION_GRAND_FORMAT: 'impression_grand_format',
  AUTRE_SERVICE: 'autre_service'
});

export const SERVICE_LABELS = Object.freeze({
  impression_papier: 'Impression papier',
  photocopie: 'Photocopie',
  saisie: 'Saisie',
  plastification: 'Plastification',
  impression_bache: 'Impression bâche',
  impression_grand_format: 'Impression grand format',
  autre_service: 'Autre service'
});

const ROLE_PERMISSIONS = {
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
};

const ROLE_SERVICES = {
  services: Object.values(SERVICE_TYPES),
  secretaire_1: [
    SERVICE_TYPES.IMPRESSION_BACHE,
    SERVICE_TYPES.IMPRESSION_GRAND_FORMAT,
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
};

export function getPermissions(profil) {
  if (profil?.role === 'directeur' || profil?.role === 'admin') {
    return Object.values(PERMISSIONS);
  }

  if (Array.isArray(profil?.permissions)) {
    return profil.permissions;
  }

  return ROLE_PERMISSIONS[profil?.poste || 'services'] || [];
}

export function hasPermission(profil, permission) {
  return getPermissions(profil).includes(permission);
}

export function getServiceTypes(profil) {
  if (profil?.role === 'directeur' || profil?.role === 'admin') {
    return Object.values(SERVICE_TYPES);
  }

  if (Array.isArray(profil?.serviceTypes)) {
    return profil.serviceTypes;
  }

  return ROLE_SERVICES[profil?.poste || 'services'] || [];
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
