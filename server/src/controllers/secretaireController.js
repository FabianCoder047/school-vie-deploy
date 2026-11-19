// Contrôleur HTTP — élèves, inscriptions, paiement d'inscription (Secrétaire).
const path = require('path');
const fs = require('fs');
const studentService = require('../services/studentService');
const paymentService = require('../services/paymentService');
const feeService = require('../services/feeService');
const { ApiError } = require('../utils/ApiError');
const studentRepo = require('../repositories/studentRepository');
const { log: audit } = require('../repositories/auditRepository');
const { DOSSIER_UPLOADS } = require('../middlewares/upload');

/* ===== INSCRIPTION ===== */
async function inscrire(req, res, next) {
  try {
    const result = await studentService.inscrireEleve(req.body, req.user.id, req.ip);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function classesPourInscription(req, res, next) {
  try {
    res.json(await feeService.classesPourInscription(req.query.academic_year_id || null));
  } catch (err) { next(err); }
}

async function fraisClasse(req, res, next) {
  try {
    const frais = await feeService.fraisClassePourInscription(Number(req.params.classId), req.query.academic_year_id || null);
    res.json(frais || { modalites: [] });
  } catch (err) { next(err); }
}

/* ===== LISTE / FICHE ÉLÈVES ===== */
async function listerEleves(req, res, next) {
  try { res.json(await studentService.listerEleves(req.query)); } catch (err) { next(err); }
}

async function ficheEleve(req, res, next) {
  try { res.json(await studentService.ficheEleve(Number(req.params.enrollmentId))); } catch (err) { next(err); }
}

async function modifierEleve(req, res, next) {
  try {
    const fiche = await studentService.modifierEleve(Number(req.params.enrollmentId), req.body, req.user.id, req.ip);
    res.json(fiche);
  } catch (err) { next(err); }
}

async function uploadPhoto(req, res, next) {
  try {
    if (!req.file) throw ApiError.badRequest('Aucun fichier reçu.', 'FICHIER_REQUIS');
    const enrollment = await studentService.ficheEleve(Number(req.params.enrollmentId));
    const anciennePhoto = enrollment.photo_path;
    await studentRepo.updatePhoto(enrollment.student_id, `/uploads/photos/${req.file.filename}`);
    supprimerFichierPhoto(anciennePhoto);
    await audit({ userId: req.user.id, action: 'UPDATE_PHOTO', entity: 'students', entityId: enrollment.student_id, ipAddress: req.ip });
    res.json(await studentService.ficheEleve(Number(req.params.enrollmentId)));
  } catch (err) { next(err); }
}

/** Supprime le fichier disque d'une photo (best-effort, jamais bloquant). */
function supprimerFichierPhoto(photoPath) {
  if (!photoPath || !photoPath.startsWith('/uploads/photos/')) return;
  const fichier = path.join(DOSSIER_UPLOADS, 'photos', path.basename(photoPath));
  fs.promises.unlink(fichier).catch(() => { /* déjà absent : tant pis */ });
}

async function supprimerPhoto(req, res, next) {
  try {
    const enrollment = await studentService.ficheEleve(Number(req.params.enrollmentId));
    if (!enrollment.photo_path) throw ApiError.badRequest('Aucune photo à supprimer.', 'PHOTO_ABSENTE');
    const chemin = enrollment.photo_path;
    await studentRepo.updatePhoto(enrollment.student_id, null);
    supprimerFichierPhoto(chemin);
    await audit({ userId: req.user.id, action: 'DELETE_PHOTO', entity: 'students', entityId: enrollment.student_id, ipAddress: req.ip });
    res.json(await studentService.ficheEleve(Number(req.params.enrollmentId)));
  } catch (err) { next(err); }
}

/* ===== PAIEMENT D'INSCRIPTION + SITUATION ===== */
async function payerInscription(req, res, next) {
  try {
    const payment = await paymentService.payerFraisInscription(Number(req.params.enrollmentId), req.body, req.user.id, req.ip);
    res.status(201).json({ paiement: payment });
  } catch (err) { next(err); }
}

async function situation(req, res, next) {
  try { res.json(await paymentService.situation(Number(req.params.enrollmentId))); } catch (err) { next(err); }
}

/* ===== DASHBOARD ===== */
async function dashboard(_req, res, next) {
  try { res.json(await require('../services/dashboardService').dashboardSecretaire()); } catch (err) { next(err); }
}

module.exports = {
  inscrire,
  classesPourInscription,
  fraisClasse,
  listerEleves,
  ficheEleve,
  modifierEleve,
  uploadPhoto,
  supprimerPhoto,
  payerInscription,
  situation,
  dashboard,
};
