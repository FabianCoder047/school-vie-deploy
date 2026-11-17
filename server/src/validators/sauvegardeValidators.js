// Schémas Zod — sauvegardes.
const { z } = require('zod');

const generationSauvegardeSchema = z.object({
  academic_year_id: z.coerce.number().int().positive().optional().nullable(),
  format: z.enum(['SQL', 'JSON'], { errorMap: () => ({ message: 'Format invalide (SQL ou JSON).' }) }),
});

module.exports = { generationSauvegardeSchema };
