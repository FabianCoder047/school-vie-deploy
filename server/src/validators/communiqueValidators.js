// Schémas Zod — communiqués (cible multiple).
const { z } = require('zod');

const cibleSchema = z.discriminatedUnion('target_type', [
  z.object({ target_type: z.literal('TOUS') }),
  z.object({ target_type: z.literal('ROLE'), role: z.enum(['SECRETAIRE', 'COMPTABLE', 'PROFESSEUR', 'PARENT']) }),
  z.object({ target_type: z.literal('CYCLE'), cycle_id: z.coerce.number().int().positive() }),
  z.object({ target_type: z.literal('CLASSE'), class_id: z.coerce.number().int().positive() }),
  z.object({ target_type: z.literal('ALIAS'), class_alias_id: z.coerce.number().int().positive() }),
]);

const communiqueSchema = z.object({
  titre: z.string().trim().min(3, 'Le titre est requis (3 caractères minimum).').max(200),
  contenu: z.string().trim().min(10, 'Le contenu est requis (10 caractères minimum).').max(5000),
  cibles: z.array(cibleSchema).min(1, 'Choisissez au moins un destinataire.'),
});

module.exports = { communiqueSchema };
