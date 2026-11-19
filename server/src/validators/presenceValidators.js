// Schémas zod — présences / justifications de motifs d'absence.
const { z } = require('zod');

const motifSchema = z.object({
  motif: z.string({ required_error: 'Le motif est requis.' })
    .trim()
    .min(3, 'Le motif doit contenir au moins 3 caractères.')
    .max(500, 'Le motif est trop long (500 caractères maximum).'),
});

module.exports = { motifSchema };
