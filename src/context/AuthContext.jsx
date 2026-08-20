import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config/api';

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
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken && !isTokenExpired(storedToken)) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        console.error("Erreur lors de la lecture des données utilisateur :", e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else if (storedToken && isTokenExpired(storedToken)) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    return null;
  });

  // Déconnexion
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken && isTokenExpired(storedToken)) {
      logout();
    }
  }, [logout]);

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
        loading: false
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};