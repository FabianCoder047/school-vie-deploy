-- =====================================================================
-- 012 — Délégations de tâches décidées par le Directeur.
-- Les indications ci-dessous sont des interrupteurs consultés par l'API
-- (middleware exigerDelegation) : aucun rôle supplémentaire n'est créé,
-- seul l'accès à certaines tâches est temporairement étendu.
--   - matières + affectations → Secrétaire (délégation permanente par défaut)
--   - années académiques      → Secrétaire (au choix du Directeur)
--   - inscriptions            → Comptable (si la Secrétaire est absente)
--   - paiements de scolarité  → Secrétaire (si le Comptable est absent)
-- Chaque bascule est journalisée dans audit_logs (action UPDATE_DELEGATIONS).
-- =====================================================================
ALTER TABLE school_settings
  ADD COLUMN matieres_secretaire_autorisee      TINYINT(1) NOT NULL DEFAULT 1 AFTER edts_impression_autorisee,
  ADD COLUMN affectations_secretaire_autorisee  TINYINT(1) NOT NULL DEFAULT 1 AFTER matieres_secretaire_autorisee,
  ADD COLUMN annees_secretaire_autorisee        TINYINT(1) NOT NULL DEFAULT 0 AFTER affectations_secretaire_autorisee,
  ADD COLUMN inscriptions_comptable_autorisee   TINYINT(1) NOT NULL DEFAULT 0 AFTER annees_secretaire_autorisee,
  ADD COLUMN paiements_secretaire_autorisee     TINYINT(1) NOT NULL DEFAULT 0 AFTER inscriptions_comptable_autorisee;
