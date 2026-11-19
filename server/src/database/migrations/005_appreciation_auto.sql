-- L'appréciation des notes n'est plus saisie par les professeurs :
-- elle est calculée automatiquement à partir de la moyenne de la matière.
-- On neutralise les appréciations éventuellement saisies auparavant.
UPDATE grades SET appreciation = NULL;
