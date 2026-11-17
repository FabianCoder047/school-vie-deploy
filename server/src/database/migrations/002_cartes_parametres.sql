-- Champs "carte scolaire" configurables par l'admin :
-- BP, ville, pays, nom du directeur, signature du directeur et cachet (images).
-- Les cartes utilisent ces valeurs ; sans elles, les zones pointillées restent vides.
ALTER TABLE school_settings
  ADD COLUMN bp              VARCHAR(30)  NULL AFTER telephone,
  ADD COLUMN ville           VARCHAR(80)  NULL AFTER bp,
  ADD COLUMN pays            VARCHAR(60)  NULL AFTER ville,
  ADD COLUMN directeur_nom   VARCHAR(190) NULL AFTER email,
  ADD COLUMN signature_path  VARCHAR(255) NULL AFTER directeur_nom,
  ADD COLUMN cachet_path     VARCHAR(255) NULL AFTER signature_path;
