// Schémas Zod — périodes d'évaluation, emploi du temps, notes, appel.
const { z } = require('zod');

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date attendue (AAAA-MM-JJ).');
const datetimeISO = z.string().regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/, 'Date/heure attendue.');

const periodeSchema = z.object({
  academic_year_id: z.coerce.number().int().positive().optional().nullable(),
  libelle: z.string().trim().min(1, 'Le libellé est requis (ex : Trimestre 1).').max(60),
  ordre: z.coerce.number().int().min(1, 'L’ordre est requis (1, 2, 3…).').max(20),
  date_debut: dateISO,
  date_fin: dateISO,
  saisie_debut: datetimeISO.optional().nullable(),
  saisie_fin: datetimeISO.optional().nullable(),
});

const creneauSchema = z.object({
  academic_year_id: z.coerce.number().int().positive().optional().nullable(),
  class_alias_id: z.coerce.number().int().positive('L’alias est requis.'),
  teacher_assignment_id: z.coerce.number().int().positive('L’affectation est requise.'),
  jour_semaine: z.coerce.number().int().min(1, 'Jour invalide (1=lundi … 7=dimanche).').max(7),
  heure_debut: z.string().regex(/^\d{2}:\d{2}/, 'Heure attendue (HH:MM).'),
  nb_heures: z.coerce.number().int().min(1).max(8).default(1),
  salle: z.string().trim().max(50).optional().nullable(),
});

const noteValeur = z.union([z.coerce.number().min(0, 'Note entre 0 et 20.').max(20, 'Note entre 0 et 20.'), z.literal(''), z.null()]).optional();

const feuilleNotesSchema = z.object({
  class_alias_id: z.coerce.number().int().positive('La classe/alias est requise.'),
  class_subject_id: z.coerce.number().int().positive('La matière est requise.'),
  evaluation_period_id: z.coerce.number().int().positive('La période est requise.'),
  notes: z.array(z.object({
    enrollment_id: z.coerce.number().int().positive(),
    interro: noteValeur,
    devoir: noteValeur,
    compo: noteValeur,
  })).min(1, 'La feuille est vide.'),
});

const appelSchema = z.object({
  teacher_assignment_id: z.coerce.number().int().positive('Le créneau est requis.'),
  timetable_slot_id: z.coerce.number().int().positive().optional().nullable(),
  date_cours: dateISO,
  heure_debut: z.string().regex(/^\d{2}:\d{2}/, 'Heure attendue (HH:MM).'),
  records: z.array(z.object({
    enrollment_id: z.coerce.number().int().positive(),
    statut: z.enum(['PRESENT', 'ABSENT', 'RETARD'], { errorMap: () => ({ message: 'Statut invalide (PRESENT, ABSENT ou RETARD).' }) }),
    minutes_retard: z.coerce.number().int().positive('Minutes de retard > 0.').max(240).optional().nullable(),
    justification_statut: z.enum(['NON_JUSTIFIEE', 'JUSTIFIEE']).optional().nullable(),
    justification_note: z.string().trim().max(500).optional().nullable(),
  })).min(1, 'Aucun élève dans l’appel.'),
});

module.exports = { periodeSchema, creneauSchema, feuilleNotesSchema, appelSchema };
