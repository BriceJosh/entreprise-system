const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Accès non autorisé. Token manquant.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'SECRET_KEY_PAR_DEFAUT'
    );

    const userId = decoded._id || decoded.id || decoded.userId;
    const siteObj = decoded.site || null;
    const siteId =
      decoded.site_id ||
      siteObj?.id ||
      siteObj?._id ||
      (typeof decoded.site === 'string' ? decoded.site : null);

    req.user = {
      ...decoded,
      _id: userId,
      id: userId,
      userId,
      role: decoded.role,
      poste: decoded.poste || 'services',
      site_id: siteId,
      site: siteObj
    };

    next();
  } catch (err) {
    console.error('Erreur vérification token :', err.message);
    return res.status(401).json({
      message: 'Token invalide ou expiré.'
    });
  }
};

const checkRole = (rolesAutorises) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Utilisateur non authentifié.'
      });
    }

    const roles = Array.isArray(rolesAutorises)
      ? rolesAutorises
      : [rolesAutorises];

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Accès refusé : privilèges insuffisants.'
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  checkRole
};
