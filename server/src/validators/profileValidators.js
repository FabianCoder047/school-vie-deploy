// Schéma Zod — modification du profil.
const { z } = require('zod');

const profilSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est requis.').max(100),
  prenom: z.string().trim().min(1, 'Le prénom est requis.').max(100),
  email: z.string().trim().email('Adresse e-mail invalide.').max(190).optional().nullable().or(z.literal('')),
  telephone: z.string().trim().max(30).optional().nullable().or(z.literal('')),
});

module.exports = { profilSchema };
