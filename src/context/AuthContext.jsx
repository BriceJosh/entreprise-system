import React, { createContext, useState, useContext, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/**
 * Helper utilitaire pour vérifier si le token JWT est expiré
 */
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = JSON.parse(decodedJson);
    if (!decoded.exp) return false;
    return decoded.exp * 1000 < Date.now();
  } catch (e) {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Vérification de la session et de la validité du token au chargement
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      if (isTokenExpired(storedToken)) {
        console.warn("Session expirée. Déconnexion automatique.");
        logout();
      } else {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error("Erreur lors de la lecture des données utilisateur :", e);
          logout();
        }
      }
    }
    setLoading(false);
  }, []);

  // Fonction de connexion
  const login = async (email, password) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Identifiants invalides');
      }

      const userData = data.user || data;
      const token = data.token;

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      if (token) {
        localStorage.setItem('token', token);
      }

      return userData;
    } catch (error) {
      console.error("Erreur lors de la connexion :", error);
      throw error;
    }
  };

  // Mise à jour locale des données utilisateur (ex: après avoir changé de mot de passe)
  const updateUser = (newUserData) => {
    setUser((prevUser) => {
      const updated = { ...prevUser, ...newUserData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  // Déconnexion
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token: localStorage.getItem('token'),
        site: user?.site || null,                     // 👉 Acces direct au site : { id, nom, ville }
        role: user?.role || null,                     // 👉 Acces direct au rôle
        doitChangerMdp: user?.doit_changer_mdp || false, // 👉 Drapeau pour le changement de mdp
        login, 
        logout, 
        updateUser, 
        isAuthenticated: !!user, 
        loading 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};