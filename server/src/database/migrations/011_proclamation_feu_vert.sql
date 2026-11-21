-- =====================================================================
-- 011 — Feu vert du directeur pour l'impression des fiches de proclamation
-- par la secrétaire (même principe que les cartes, bulletins et EDT).
-- =====================================================================
ALTER TABLE school_settings
  ADD COLUMN proclamations_impression_autorisee TINYINT(1) NOT NULL DEFAULT 0
  AFTER bulletins_impression_autorisee;
