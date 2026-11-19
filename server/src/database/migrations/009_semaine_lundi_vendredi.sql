-- =====================================================================
-- 009 — Pas de cours le samedi ni le dimanche : la semaine scolaire
-- s'arrête au vendredi (jour_semaine 1=lundi … 5=vendredi).
-- =====================================================================
DELETE FROM timetable_slots WHERE jour_semaine > 5;

ALTER TABLE timetable_slots
  DROP CHECK chk_slot_day,
  ADD CONSTRAINT chk_slot_day CHECK (jour_semaine BETWEEN 1 AND 5);
