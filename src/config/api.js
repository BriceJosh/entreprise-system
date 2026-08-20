// URL de base du backend API
// En production locale unifiée, une chaîne vide permet des requêtes relatives directes (/api/...)
// En développement, fallback sur http://localhost:5000
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL !== undefined
    ? import.meta.env.VITE_BACKEND_URL
    : import.meta.env.DEV
      ? "http://localhost:5000"
      : "";

export default BACKEND_URL;
