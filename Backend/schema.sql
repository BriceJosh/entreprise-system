-- ===================================================================
-- SCHÉMA POSTGRESQL ULTRA-ROBUSTE & SÉCURISÉ CONTRE LES COUPURES
-- Entreprise System - Production Windows Server 2022
-- ===================================================================

CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(24) PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    ville VARCHAR(255),
    telephone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(24) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    poste VARCHAR(50) DEFAULT 'services',
    doit_changer_mdp BOOLEAN DEFAULT TRUE,
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocks (
    id VARCHAR(24) PRIMARY KEY,
    nom_article VARCHAR(255) NOT NULL,
    quantite NUMERIC DEFAULT 0,
    seuil_alerte NUMERIC DEFAULT 5,
    multiplicateur_detail NUMERIC DEFAULT 1,
    multiplicateur_gros NUMERIC DEFAULT 1,
    prix_vente NUMERIC DEFAULT 0,
    prix_vente_unite NUMERIC DEFAULT 0,
    prix_vente_detail NUMERIC DEFAULT 0,
    prix_vente_gros NUMERIC DEFAULT 0,
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_mouvements (
    id VARCHAR(24) PRIMARY KEY,
    nom_article VARCHAR(255) NOT NULL,
    mouvement_type VARCHAR(50) NOT NULL,
    type_entree VARCHAR(50) DEFAULT 'Pièce',
    quantite_entree NUMERIC DEFAULT 1,
    quantite_unites NUMERIC DEFAULT 1,
    prix_total NUMERIC DEFAULT 0,
    prix_vente_unitaire NUMERIC DEFAULT 0,
    prix_vente_detail NUMERIC DEFAULT 0,
    prix_vente_gros NUMERIC DEFAULT 0,
    description TEXT,
    stock_id VARCHAR(24),
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recus (
    id VARCHAR(24) PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL,
    montant_total NUMERIC NOT NULL,
    montant_paye NUMERIC,
    monnaie_rendue NUMERIC,
    nom_client VARCHAR(255),
    servi_par VARCHAR(255),
    site_nom VARCHAR(255),
    site_telephone VARCHAR(50),
    lignes JSONB NOT NULL DEFAULT '[]'::jsonb,
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activites (
    id VARCHAR(24) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    description TEXT,
    quantite NUMERIC DEFAULT 1,
    quantite_unites NUMERIC DEFAULT 1,
    prix_unitaire NUMERIC DEFAULT 0,
    montant_total NUMERIC DEFAULT 0,
    option_vente VARCHAR(50),
    longueur NUMERIC,
    largeur NUMERIC,
    surface_m2 NUMERIC,
    prix_m2 NUMERIC,
    recu_id VARCHAR(24) REFERENCES recus(id) ON DELETE SET NULL,
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depenses (
    id VARCHAR(24) PRIMARY KEY,
    motif VARCHAR(255) NOT NULL,
    montant NUMERIC NOT NULL,
    beneficiaire VARCHAR(255),
    justificatif VARCHAR(255),
    date TIMESTAMPTZ DEFAULT NOW(),
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depots_banque (
    id VARCHAR(24) PRIMARY KEY,
    banque VARCHAR(255) NOT NULL,
    montant NUMERIC NOT NULL,
    numero_bordereau VARCHAR(100),
    date_depot TIMESTAMPTZ DEFAULT NOW(),
    commentaire TEXT,
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credits (
    id VARCHAR(24) PRIMARY KEY,
    client VARCHAR(255) NOT NULL,
    telephone VARCHAR(50),
    montant NUMERIC NOT NULL,
    reste NUMERIC NOT NULL,
    statut VARCHAR(50) DEFAULT 'en_cours',
    paiements JSONB DEFAULT '[]'::jsonb,
    site_id VARCHAR(24) REFERENCES sites(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- NOTIFICATIONS TEMPS RÉEL (PostgreSQL LISTEN / NOTIFY)
-- ===================================================================
CREATE OR REPLACE FUNCTION notify_app_event()
RETURNS trigger AS $$
DECLARE
    payload JSON;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'id', OLD.id,
            'data', row_to_json(OLD)
        );
    ELSE
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'id', NEW.id,
            'data', row_to_json(NEW)
        );
    END IF;

    PERFORM pg_notify('app_events', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_activites ON activites;
CREATE TRIGGER trg_notify_activites AFTER INSERT OR UPDATE OR DELETE ON activites FOR EACH ROW EXECUTE FUNCTION notify_app_event();

DROP TRIGGER IF EXISTS trg_notify_stocks ON stocks;
CREATE TRIGGER trg_notify_stocks AFTER INSERT OR UPDATE OR DELETE ON stocks FOR EACH ROW EXECUTE FUNCTION notify_app_event();

DROP TRIGGER IF EXISTS trg_notify_depenses ON depenses;
CREATE TRIGGER trg_notify_depenses AFTER INSERT OR UPDATE OR DELETE ON depenses FOR EACH ROW EXECUTE FUNCTION notify_app_event();

DROP TRIGGER IF EXISTS trg_notify_depots ON depots_banque;
CREATE TRIGGER trg_notify_depots AFTER INSERT OR UPDATE OR DELETE ON depots_banque FOR EACH ROW EXECUTE FUNCTION notify_app_event();

DROP TRIGGER IF EXISTS trg_notify_credits ON credits;
CREATE TRIGGER trg_notify_credits AFTER INSERT OR UPDATE OR DELETE ON credits FOR EACH ROW EXECUTE FUNCTION notify_app_event();
