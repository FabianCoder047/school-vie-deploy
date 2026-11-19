-- Justification des absences (parents et professeurs).
-- Le parent renseigne un motif depuis son espace ; le professeur peut aussi
-- marquer une absence comme justifiée pendant/après l'appel (note optionnelle).
-- Le motif du parent est conservé lors des modifications ultérieures de l'appel.
ALTER TABLE attendance_records
  MODIFY justification VARCHAR(500) NULL,
  ADD COLUMN justification_statut ENUM('NON_JUSTIFIEE','JUSTIFIEE') NOT NULL DEFAULT 'NON_JUSTIFIEE',
  ADD COLUMN justification_par ENUM('PARENT','PROFESSEUR') NULL,
  ADD COLUMN justification_at DATETIME NULL;
