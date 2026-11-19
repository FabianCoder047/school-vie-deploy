-- =====================================================================
-- 008 — Horaires scolaires de l'emploi du temps.
-- Journée type : début 07:00, 1 heure de cours = 55 min,
-- pause 09:45 → 10:10, reprise 10:10 → fin de matinée 12:00.
-- Collège / lycée : retour à 14:30, fin configurable (17:30 par défaut).
-- Primaire : fin à 11:30, durée des cours libre (heure de fin saisie).
-- Toutes les valeurs sont modifiables dans les paramètres de l'école.
-- =====================================================================
ALTER TABLE school_settings
  ADD COLUMN debut_journee     TIME NOT NULL DEFAULT '07:00:00' AFTER duree_heure_minutes,
  ADD COLUMN pause_matin_debut TIME NOT NULL DEFAULT '09:45:00' AFTER debut_journee,
  ADD COLUMN pause_matin_fin   TIME NOT NULL DEFAULT '10:10:00' AFTER pause_matin_debut,
  ADD COLUMN fin_matin         TIME NOT NULL DEFAULT '12:00:00' AFTER pause_matin_fin,
  ADD COLUMN debut_apres_midi  TIME NOT NULL DEFAULT '14:30:00' AFTER fin_matin,
  ADD COLUMN fin_apres_midi    TIME NOT NULL DEFAULT '17:30:00' AFTER debut_apres_midi,
  ADD COLUMN fin_primaire      TIME NOT NULL DEFAULT '11:30:00' AFTER fin_apres_midi;

-- duree_libre = 1 : créneau du primaire avec heure de fin saisie manuellement
-- (nb_heures mis à 0 dans ce cas, la durée n'étant pas un multiple de 55 min).
ALTER TABLE timetable_slots
  ADD COLUMN duree_libre TINYINT(1) NOT NULL DEFAULT 0 AFTER nb_heures;
