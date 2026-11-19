-- =====================================================================
-- 010 — Feu vert du directeur pour l'impression des emplois du temps
-- par la secrétaire (même principe que les cartes et les bulletins).
-- =====================================================================
ALTER TABLE school_settings
  ADD COLUMN edts_impression_autorisee TINYINT(1) NOT NULL DEFAULT 0
  AFTER bulletins_impression_autorisee;
