-- =====================================================================
-- 006 — Feu vert du directeur pour l'impression (cartes / bulletins)
--        + cibles de communiqués étendues aux rôles ADMIN / DIRECTEUR
-- =====================================================================

-- Autorisations permanentes, activables/désactivables par le DIRECTEUR.
-- Tant qu'une autorisation n'est pas levée, la SECRÉTAIRE reçoit 403
-- IMPRESSION_NON_AUTORISEE à la génération du PDF correspondant.
ALTER TABLE school_settings
  ADD COLUMN cartes_impression_autorisee    TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN bulletins_impression_autorisee TINYINT(1) NOT NULL DEFAULT 0;

-- Communiqués ciblables vers les comptes ADMIN et DIRECTEUR (en plus des
-- rôles personnel/parents déjà présents).
ALTER TABLE announcement_targets
  MODIFY role ENUM('ADMIN','DIRECTEUR','SECRETAIRE','COMPTABLE','PROFESSEUR','PARENT') NULL;
