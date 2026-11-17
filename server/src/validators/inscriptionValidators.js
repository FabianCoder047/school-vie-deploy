// Schémas Zod — inscriptions, paiements, frais, relances.
const { z } = require('zod');

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).');
const MOYENS = z.enum(['ESPECES', 'FLOOZ', 'MIXX_BY_YAS'], { errorMap: () => ({ message: 'Moyen de paiement invalide (Espèces, Flooz, Mixx By Yas).' }) });
const MODALITES = ['JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL'];

const inscriptionSchema = z.object({
  eleve: z.object({
    nom: z.string().trim().min(1, 'Le nom de l’élève est requis.').max(100),
    prenom: z.string().trim().min(1, 'Le prénom de l’élève est requis.').max(100),
    sexe: z.enum(['M', 'F']).optional().nullable(),
    date_naissance: dateISO,
    lieu_naissance: z.string().trim().min(1, 'Le lieu de naissance est requis.').max(150),
    adresse: z.string().trim().min(1, 'L’adresse du domicile est requise.').max(255),
  }),
  tuteur: z.object({
    nom: z.string().trim().min(1, 'Le nom du tuteur est requis.').max(100),
    prenom: z.string().trim().min(1, 'Le prénom du tuteur est requis.').max(100),
    telephone_whatsapp: z.string().trim().min(6, 'Le téléphone WhatsApp est requis.').max(30),
    email: z.string().trim().email('Adresse e-mail invalide.').max(190).optional().nullable().or(z.literal('')),
  }),
  academique: z.object({
    academic_year_id: z.coerce.number().int().positive().optional().nullable(),
    class_id: z.coerce.number().int().positive('La classe est requise.'),
    class_alias_id: z.coerce.number().int().positive().optional().nullable(),
    modalite_paiement: z.enum(MODALITES, { errorMap: () => ({ message: 'Modalité de paiement invalide.' }) }),
    date_inscription: dateISO.optional(),
  }),
});

const paiementInscriptionSchema = z.object({
  moyen: MOYENS,
  reference_transaction: z.string().trim().max(100).optional().nullable(),
  montant: z.coerce.number().positive('Le montant doit être positif.').optional(),
  date_paiement: z.string().optional(),
});

const paiementScolariteSchema = z.object({
  enrollment_id: z.coerce.number().int().positive('L’élève est requis.'),
  montant: z.coerce.number().positive('Le montant doit être positif.'),
  moyen: MOYENS,
  reference_transaction: z.string().trim().max(100).optional().nullable(),
  date_paiement: z.string().optional(),
});

const annulationPaiementSchema = z.object({
  motif: z.string().trim().min(3, 'Un motif d’au moins 3 caractères est requis.').max(255),
});

const fraisUnitaireSchema = z.object({
  academic_year_id: z.coerce.number().int().positive().optional().nullable(),
  class_id: z.coerce.number().int().positive('La classe est requise.'),
  frais_inscription: z.coerce.number().min(0, 'Les frais d’inscription doivent être positifs ou nuls.'),
  montant_scolarite: z.coerce.number().min(0, 'La scolarité doit être positive ou nulle.'),
  modalites: z.array(z.enum(MODALITES)).min(1, 'Cochez au moins une modalité.'),
});

const fraisGroupeSchema = z.object({
  academic_year_id: z.coerce.number().int().positive().optional().nullable(),
  class_ids: z.array(z.coerce.number().int().positive()).min(1, 'Sélectionnez au moins une classe.'),
  frais_inscription: z.coerce.number().min(0),
  montant_scolarite: z.coerce.number().min(0),
  modalites: z.array(z.enum(MODALITES)).min(1, 'Cochez au moins une modalité.'),
});

const relanceSchema = z.object({
  enrollment_ids: z.array(z.coerce.number().int().positive()).optional(),
  filtres: z.object({
    cycle_id: z.coerce.number().int().optional(),
    class_id: z.coerce.number().int().optional(),
    class_alias_id: z.coerce.number().int().optional(),
    modalite_paiement: z.enum(MODALITES).optional(),
    academic_year_id: z.coerce.number().int().optional(),
  }).optional(),
  message: z.string().trim().max(500).optional(),
}).refine((data) => (data.enrollment_ids && data.enrollment_ids.length > 0) || data.filtres, {
  message: 'Indiquez les comptes à relancer (sélection ou filtres).',
  path: ['enrollment_ids'],
});

const modifierEleveSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  sexe: z.enum(['M', 'F']).optional().nullable(),
  date_naissance: dateISO,
  lieu_naissance: z.string().trim().min(1).max(150),
  adresse: z.string().trim().min(1).max(255),
  class_id: z.coerce.number().int().positive().optional(),
  class_alias_id: z.coerce.number().int().positive().optional(),
  tuteur: z.object({
    nom: z.string().trim().min(1).max(100),
    prenom: z.string().trim().min(1).max(100),
    telephone_whatsapp: z.string().trim().min(6).max(30),
    email: z.string().trim().email().max(190).optional().nullable().or(z.literal('')),
  }).optional(),
});

module.exports = {
  inscriptionSchema,
  paiementInscriptionSchema,
  paiementScolariteSchema,
  annulationPaiementSchema,
  fraisUnitaireSchema,
  fraisGroupeSchema,
  relanceSchema,
  modifierEleveSchema,
  MODALITES,
};
