// Schémas Zod — messages d'erreur en français.
const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(190)
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre.');

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'L’identifiant est requis (e-mail ou téléphone).').max(190),
  password: z.string().min(1, 'Le mot de passe est requis.').max(190),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis.'),
  newPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'L’identifiant est requis (e-mail ou téléphone).').max(190),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Lien invalide.'),
  newPassword: passwordSchema,
});

module.exports = {
  passwordSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
