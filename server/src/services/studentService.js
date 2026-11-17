// =====================================================================
// Inscription des élèves (espace Secrétaire).
// Transaction complète : tuteur (find-or-create par téléphone) → compte
// Parent (création unique, partagée entre frères/sœurs) → élève avec
// matricule séquentiel → inscription à l'année (frais FIGÉS) →
// échéancier généré selon la modalité cochée.
// =====================================================================
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { ApiError } = require('../utils/ApiError');
const { generateDefaultPassword } = require('../utils/password');
const { waLink } = require('../utils/waLink');
const { genererEcheancier } = require('../utils/echeancier');
const { nextMatricule } = require('../utils/sequences');
const studentRepo = require('../repositories/studentRepository');
const enrollmentRepo = require('../repositories/enrollmentRepository');
const scheduleRepo = require('../repositories/paymentScheduleRepository');
const feeRepo = require('../repositories/tuitionFeeRepository');
const yearRepo = require('../repositories/academicYearRepository');
const classRepo = require('../repositories/classRepository');
const aliasRepo = require('../repositories/classAliasRepository');
const userMgmtRepo = require('../repositories/userManagementRepository');
const paymentRepo = require('../repositories/paymentRepository');
const notificationRepo = require('../repositories/notificationRepository');
const { sendWelcomeCredentials } = require('./authService');
const { log: audit } = require('../repositories/auditRepository');
const logger = require('../utils/logger');

function formaterMontant(n) {
  return `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} FCFA`;
}

/**
 * Inscription complète d'un élève.
 * @returns {Promise<{enrollmentId, studentId, matricule, compteParent: object, echeances: number}>}
 */
async function inscrireEleve(data, actorId, ip) {
  const { eleve, tuteur, academique } = data;

  // ---- Validation amont (année, classe, alias, frais, modalité) ----
  let anneeId = academique.academic_year_id ? Number(academique.academic_year_id) : null;
  if (!anneeId) {
    const courante = await yearRepo.findCurrent();
    if (!courante) throw ApiError.badRequest('Aucune année académique courante n’est définie.', 'NO_CURRENT_YEAR');
    anneeId = courante.id;
  }
  const annee = await yearRepo.findById(anneeId);
  if (!annee) throw ApiError.badRequest('Année académique introuvable.', 'YEAR_NOT_FOUND');

  const classe = await classRepo.findById(academique.class_id);
  if (!classe) throw ApiError.badRequest('Classe introuvable.', 'CLASSE_NOT_FOUND');
  // Alias facultatif : si absent, la classe entière est utilisée comme groupe unique.
  let alias;
  if (academique.class_alias_id) {
    alias = await aliasRepo.findById(academique.class_alias_id);
    if (!alias) throw ApiError.badRequest('Alias introuvable.', 'ALIAS_NOT_FOUND');
    if (alias.class_id !== classe.id) {
      throw ApiError.badRequest('L’alias ne correspond pas à la classe choisie.', 'ALIAS_CLASS_MISMATCH');
    }
  } else {
    alias = await aliasRepo.findOuCreerDefaut(classe.id, classe.nom);
    if (!alias) throw ApiError.badRequest('Impossible de créer le groupe de la classe.', 'ALIAS_DEFAUT_ECHEC');
  }

  const frais = await feeRepo.findByYearAndClass(anneeId, classe.id);
  if (!frais) {
    throw ApiError.badRequest(
      `Les frais de scolarité ne sont pas définis pour la classe « ${classe.nom} » sur cette année. Demandez au Directeur de les renseigner.`,
      'FRAIS_NON_DEFINIS'
    );
  }
  if (!frais.modalites.includes(academique.modalite_paiement)) {
    throw ApiError.badRequest(
      `La modalité « ${academique.modalite_paiement} » n’est pas autorisée pour cette classe (autorisées : ${frais.modalites.join(', ')}).`,
      'MODALITE_NON_AUTORISEE'
    );
  }

  const telephone = String(tuteur.telephone_whatsapp || '').trim();
  if (!telephone) throw ApiError.badRequest('Le téléphone WhatsApp du tuteur est requis.', 'TELEPHONE_REQUIS');
  const emailTuteur = (tuteur.email || '').trim().toLowerCase() || null;

  // ---- Transaction : tuteur → compte parent → élève → inscription → échéancier ----
  const conn = await pool.getConnection();
  let enrollmentId;
  let studentId;
  let matricule;
  let compteParentCree = false;
  let parentUserId = null;
  let motDePasseParent = null;
  let parentEmailEnvoye = false;
  let parentSansEmail = false;

  try {
    await conn.beginTransaction();

    // 1) Tuteur : find-or-create par téléphone (un tuteur = plusieurs enfants).
    let guardian = await studentRepo.findGuardianByPhone(telephone);
    if (!guardian) {
      guardian = await studentRepo.createGuardian(
        { nom: tuteur.nom.trim(), prenom: tuteur.prenom.trim(), telephone_whatsapp: telephone, email: emailTuteur },
        conn
      );
    } else if (emailTuteur && !guardian.email) {
      await studentRepo.updateGuardian(guardian.id, { nom: guardian.nom, prenom: guardian.prenom, telephone_whatsapp: telephone, email: emailTuteur });
      guardian = { ...guardian, email: emailTuteur };
    }

    // 2) Compte Parent : rattachement si le tuteur en a déjà un, sinon création.
    if (guardian.user_id) {
      parentUserId = guardian.user_id;
    } else {
      let userParent = await userMgmtRepo.findLightByPhone(telephone);
      if (!userParent && emailTuteur) userParent = await userMgmtRepo.findLightByEmail(emailTuteur);

      if (userParent && userParent.role !== 'PARENT') {
        throw ApiError.conflict('Ce numéro ou cet e-mail est déjà utilisé par un compte non-parent.', 'IDENTIFIANT_DEJA_UTILISE');
      }
      if (userParent) {
        parentUserId = userParent.id;
        await studentRepo.linkGuardianToUser(guardian.id, parentUserId, conn);
      } else {
        motDePasseParent = generateDefaultPassword();
        const passwordHash = await bcrypt.hash(motDePasseParent, 12);
        const nouveau = await userMgmtRepo.create({
          role: 'PARENT',
          nom: tuteur.nom.trim(),
          prenom: tuteur.prenom.trim(),
          email: emailTuteur,
          telephone,
          passwordHash,
          createdBy: actorId,
        }, conn);
        parentUserId = nouveau.id;
        compteParentCree = true;
        await studentRepo.linkGuardianToUser(guardian.id, parentUserId, conn);
      }
    }

    // 3) Élève + matricule (année de début de l'année académique).
    const anneeMatricule = new Date(annee.date_debut).getUTCFullYear();
    matricule = await nextMatricule(anneeMatricule, conn);
    studentId = await studentRepo.createStudent(
      {
        matricule,
        nom: eleve.nom.trim(),
        prenom: eleve.prenom.trim(),
        sexe: eleve.sexe || null,
        date_naissance: eleve.date_naissance,
        lieu_naissance: eleve.lieu_naissance.trim(),
        adresse: eleve.adresse.trim(),
        guardian_id: guardian.id,
      },
      conn
    );

    // 4) Inscription (frais FIGÉS au moment de l'inscription).
    const dateInscription = academique.date_inscription || new Date().toISOString().slice(0, 10);
    enrollmentId = await enrollmentRepo.create(
      {
        student_id: studentId,
        academic_year_id: anneeId,
        class_id: classe.id,
        class_alias_id: alias.id,
        modalite_paiement: academique.modalite_paiement,
        frais_inscription: frais.frais_inscription,
        montant_scolarite: frais.montant_scolarite,
        statut: 'EN_ATTENTE',
        date_inscription: dateInscription,
        created_by: actorId,
      },
      conn
    );

    // 5) Échéancier selon la modalité choisie.
    const echeancesPlain = genererEcheancier({
      modalite: academique.modalite_paiement,
      montantScolarite: frais.montant_scolarite,
      dateDebut: annee.date_debut,
      dateFin: annee.date_fin,
    }).map((l) => ({ ...l, enrollment_id: enrollmentId }));
    await scheduleRepo.insertBatch(echeancesPlain, conn);

    // 6) Audit.
    await audit({
      userId: actorId,
      action: 'CREATE',
      entity: 'enrollments',
      entityId: enrollmentId,
      newValues: { matricule, eleve: `${eleve.prenom} ${eleve.nom}`, classe: classe.nom, alias: alias.nom, modalite: academique.modalite_paiement },
      ipAddress: ip,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // ---- Post-commit : notification interne + mail d'identifiants ----
  let fiche = null;
  try {
    fiche = await enrollmentRepo.findById(enrollmentId);
    if (parentUserId) {
      await notificationRepo.create({
        user_id: parentUserId,
        type: 'SCOLARITE',
        titre: 'Inscription enregistrée',
        message: `${eleve.prenom} ${eleve.nom} (${matricule}) est inscrit(e) en ${fiche.classe_nom} — ${fiche.alias_nom} pour l’année ${fiche.annee_libelle}.`,
        data: { enrollmentId, studentId },
      });
    }
    if (compteParentCree && parentUserId) {
      const compte = await pool.query('SELECT id, nom, prenom, email, telephone FROM users WHERE id = ?', [parentUserId]);
      const user = compte[0][0];
      try {
        const mail = await sendWelcomeCredentials({ user, password: motDePasseParent });
        parentEmailEnvoye = Boolean(mail.delivered);
        parentSansEmail = !user.email || mail.skipped === true;
      } catch (err) {
        logger.error('Échec de l’envoi du mail d’identifiants parent', { message: err.message });
        parentSansEmail = !user.email;
      }
    }
  } catch (err) {
    // La post-notification ne doit jamais faire échouer l'inscription.
    logger.error('Post-traitement inscription (notification/mail)', { message: err.message, enrollmentId });
  }

  const telephoneFinal = telephone;
  const messageWa = compteParentCree
    ? `Bonjour ${tuteur.prenom} ${tuteur.nom}, voici vos identifiants School Vie pour suivre la scolarité de ${eleve.prenom} ${eleve.nom} : identifiant = ${telephoneFinal}${motDePasseParent ? `, mot de passe temporaire = ${motDePasseParent} (à changer à la 1ère connexion)` : ''}.`
    : `Bonjour ${tuteur.prenom} ${tuteur.nom}, ${eleve.prenom} ${eleve.nom} (${matricule}) a bien été inscrit(e) en ${fiche?.classe_nom}. — School Vie`;

  return {
    enrollmentId,
    studentId,
    matricule,
    echeances: await scheduleRepo.listByEnrollment(enrollmentId).then((l) => l.length),
    frais: {
      frais_inscription: frais.frais_inscription,
      montant_scolarite: frais.montant_scolarite,
      modalite: academique.modalite_paiement,
    },
    compteParent: {
      cree: compteParentCree,
      existant: !compteParentCree,
      email: emailTuteur,
      telephone: telephoneFinal,
      mailEnvoye: parentEmailEnvoye,
      motDePasseTemporaire: compteParentCree && !parentEmailEnvoye ? motDePasseParent : null,
      sansEmail: parentSansEmail,
      waLink: waLink(telephoneFinal, messageWa),
    },
  };
}

/** Liste paginée (recherche + filtres). */
async function listerEleves(query) {
  return enrollmentRepo.list(query);
}

/** Fiche complète + résumé financier. */
async function ficheEleve(enrollmentId) {
  const fiche = await enrollmentRepo.findById(enrollmentId);
  if (!fiche) throw ApiError.notFound('Inscription introuvable.');
  const [echeances, payments] = await Promise.all([
    scheduleRepo.listByEnrollment(enrollmentId),
    paymentRepo.listByEnrollment(enrollmentId),
  ]);
  const totalDu = echeances.reduce((acc, e) => acc + Number(e.montant_du), 0);
  const totalPaye = echeances.reduce((acc, e) => acc + Number(e.montant_paye), 0);
  const paiementInscription = payments.find((p) => p.type === 'INSCRIPTION' && p.statut === 'VALIDE') || null;
  return {
    ...fiche,
    echeances,
    payments,
    paiementInscription,
    total_du: totalDu.toFixed(2),
    total_paye: totalPaye.toFixed(2),
    reste: (totalDu - totalPaye).toFixed(2),
  };
}

/** Modification de la fiche (infos personnelles + tuteur ; classe/alias si aucun paiement). */
async function modifierEleve(enrollmentId, data, actorId, ip) {
  const fiche = await enrollmentRepo.findById(enrollmentId);
  if (!fiche) throw ApiError.notFound('Inscription introuvable.');

  // Infos personnelles / tuteur : toujours modifiables.
  await studentRepo.updateStudent(fiche.student_id, {
    nom: data.nom.trim(),
    prenom: data.prenom.trim(),
    sexe: data.sexe || null,
    date_naissance: data.date_naissance,
    lieu_naissance: data.lieu_naissance.trim(),
    adresse: data.adresse.trim(),
  });
  if (data.tuteur) {
    await studentRepo.updateGuardian(fiche.guardian_id, {
      nom: data.tuteur.nom.trim(),
      prenom: data.tuteur.prenom.trim(),
      telephone_whatsapp: String(data.tuteur.telephone_whatsapp).trim(),
      email: (data.tuteur.email || '').trim().toLowerCase() || null,
    });
  }

  // Classe / alias : uniquement si aucun paiement enregistré.
  const changementClasse = data.class_id && Number(data.class_id) !== Number(fiche.class_id);
  const changementAlias = data.class_alias_id && Number(data.class_alias_id) !== Number(fiche.class_alias_id);
  if (changementClasse || changementAlias) {
    const nbPaiements = (await paymentRepo.listByEnrollment(enrollmentId)).length;
    if (nbPaiements > 0) {
      throw ApiError.conflict('Impossible de changer la classe ou l’alias : des paiements sont déjà enregistrés pour cet élève.', 'PAIEMENTS_EXISTANTS');
    }
    const aliasId = Number(data.class_alias_id || fiche.class_alias_id);
    const classeId = Number(data.class_id || fiche.class_id);
    const alias = await aliasRepo.findById(aliasId);
    if (!alias || alias.class_id !== classeId) {
      throw ApiError.badRequest('L’alias ne correspond pas à la classe choisie.', 'ALIAS_CLASS_MISMATCH');
    }
    await enrollmentRepo.updateClasseAlias(enrollmentId, { class_id: classeId, class_alias_id: aliasId });
  }

  await audit({ userId: actorId, action: 'UPDATE', entity: 'enrollments', entityId: enrollmentId, ipAddress: ip });
  return ficheEleve(enrollmentId);
}

/** Comptage d'inscriptions pour les dashboards. */
async function compterInscriptions(anneeId) {
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const enAttente = (await pool.query(
    "SELECT COUNT(*) AS n FROM enrollments WHERE academic_year_id = ? AND statut = 'EN_ATTENTE'",
    [anneeId]
  ))[0][0].n;
  const aujourdhui = (await pool.query(
    'SELECT COUNT(*) AS n FROM enrollments WHERE academic_year_id = ? AND date_inscription = ?',
    [anneeId, aujourdHui]
  ))[0][0].n;
  return { aujourdhui, enAttente, effectifsParCycle: await enrollmentRepo.effectifsParCycle(anneeId) };
}

module.exports = {
  inscrireEleve,
  listerEleves,
  ficheEleve,
  modifierEleve,
  compterInscriptions,
  formaterMontant,
};
