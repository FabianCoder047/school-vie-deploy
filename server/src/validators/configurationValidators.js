// Schémas Zod — configuration école, référentiels, affectations, comptes.
const { z } = require('zod');

/* ===== Référentiels ===== */
const cycleSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom du cycle est requis.').max(100),
  description: z.string().trim().max(255).optional().nullable(),
  ordre: z.coerce.number().int('L’ordre doit être un nombre entier.').min(0).max(999).default(0),
});

const classeSchema = z.object({
  cycle_id: z.coerce.number().int('Le cycle est requis.').positive('Le cycle est requis.'),
  nom: z.string().trim().min(1, 'Le nom de la classe est requis.').max(100),
  ordre: z.coerce.number().int().min(0).max(999).default(0),
});

const matiereSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom de la matière est requis.').max(120),
  code: z.string().trim().max(20).optional().nullable(),
});

const anneeAcademiqueSchema = z.object({
  libelle: z.string().trim().min(4, 'Le libellé est requis (ex : 2026-2027).').max(20)
    .regex(/^\d{4}-\d{4}$/, 'Format attendu : 2026-2027.'),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de début invalide (AAAA-MM-JJ).'),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de fin invalide (AAAA-MM-JJ).'),
});

const parametresSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom de l’école est requis.').max(190),
  adresse: z.string().trim().max(255).optional().nullable(),
  bp: z.string().trim().max(30).optional().nullable(),
  ville: z.string().trim().max(80).optional().nullable(),
  pays: z.string().trim().max(60).optional().nullable(),
  telephone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Adresse e-mail invalide.').max(190).optional().nullable().or(z.literal('')),
  directeur_nom: z.string().trim().max(190).optional().nullable(),
  devise: z.string().trim().min(1).max(10).default('FCFA'),
  note_max: z.coerce.number().positive('La note maximale doit être positive.').max(100).default(20),
  duree_heure_minutes: z.coerce.number().int().min(1, 'Durée invalide.').max(180).default(55),
});

/* ===== Comptes (Admin/Directeur) ===== */
const creationCompteSchema = z.object({
  role: z.enum(['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'PROFESSEUR'], { errorMap: () => ({ message: 'Rôle invalide.' }) }),
  nom: z.string().trim().min(1, 'Le nom est requis.').max(100),
  prenom: z.string().trim().min(1, 'Le prénom est requis.').max(100),
  email: z.string().trim().email('Adresse e-mail invalide.').max(190).optional().nullable().or(z.literal('')),
  telephone: z.string().trim().max(30).optional().nullable().or(z.literal('')),
}).refine((data) => (data.email && data.email !== '') || (data.telephone && data.telephone !== ''), {
  message: 'Un e-mail ou un téléphone est requis.',
  path: ['email'],
});

const statutCompteSchema = z.object({
  is_active: z.boolean({ required_error: 'is_active est requis.' }),
});

/* ===== Alias ===== */
const aliasSchema = z.object({
  class_id: z.coerce.number().int().positive('La classe est requise.'),
  nom: z.string().trim().min(1, 'Le nom de l’alias est requis (ex : CP1 A).').max(100),
  capacite: z.coerce.number().int().min(1, 'La capacité doit être au moins 1.').max(200).optional().nullable(),
});

/* ===== Affectations matière → classes ===== */
const affectationMatiereSchema = z.object({
  subject_id: z.coerce.number().int().positive('La matière est requise.'),
  affectations: z.array(z.object({
    class_id: z.coerce.number().int().positive(),
    coefficient: z.coerce.number().positive('Le coefficient doit être positif.').max(99.99),
  })).min(1, 'Sélectionnez au moins une classe.'),
});

/* ===== Affectations professeur → (matière × alias × année) ===== */
const affectationProfesseurSchema = z.object({
  academic_year_id: z.coerce.number().int().positive().optional().nullable(),
  teacher_id: z.coerce.number().int().positive('Le professeur est requis.'),
  affectations: z.array(z.object({
    class_subject_id: z.coerce.number().int().positive(),
    class_alias_id: z.coerce.number().int().positive(),
  })).min(1, 'Sélectionnez au moins une matière et un alias.'),
});

module.exports = {
  cycleSchema,
  classeSchema,
  matiereSchema,
  anneeAcademiqueSchema,
  parametresSchema,
  creationCompteSchema,
  statutCompteSchema,
  aliasSchema,
  affectationMatiereSchema,
  affectationProfesseurSchema,
};
