-- Preuve papier du reçu : le reçu (inscription ou paiement) est rempli à la
-- main par le secrétaire / comptable ; un scan/photo peut être joint en cas de contrôle.
ALTER TABLE payments
  ADD COLUMN justificatif_chemin VARCHAR(300) NULL,
  ADD COLUMN justificatif_at DATETIME NULL;
