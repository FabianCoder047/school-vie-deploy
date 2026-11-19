-- =====================================================================
-- 007 — Fenêtre de maintenance définie par l'administrateur.
-- Pendant la fenêtre [maintenance_debut ; maintenance_fin[, toute
-- l'application est inactive pour TOUS les rôles sauf ADMIN
-- (garde côté API, pas seulement côté front). La fenêtre expire
-- toute seule à maintenance_fin — aucun redémarrage requis.
-- =====================================================================
ALTER TABLE school_settings
  ADD COLUMN maintenance_debut   DATETIME     NULL AFTER bulletins_impression_autorisee,
  ADD COLUMN maintenance_fin     DATETIME     NULL AFTER maintenance_debut,
  ADD COLUMN maintenance_message VARCHAR(255) NULL AFTER maintenance_fin;
