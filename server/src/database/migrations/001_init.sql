-- =====================================================
-- Migration 001_init : schéma complet (section 6 du cahier)
-- =====================================================

CREATE DATABASE IF NOT EXISTS school_vie_db_004774
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_vie_db_004774;

-- =====================================================================
-- 1. UTILISATEURS, AUTHENTIFICATION, PARAMÈTRES
-- =====================================================================

CREATE TABLE users (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role                   ENUM('ADMIN','DIRECTEUR','SECRETAIRE','COMPTABLE','PROFESSEUR','PARENT') NOT NULL,
  nom                    VARCHAR(100) NOT NULL,
  prenom                 VARCHAR(100) NOT NULL,
  email                  VARCHAR(190) NULL,
  telephone              VARCHAR(30)  NULL,
  password_hash          VARCHAR(255) NOT NULL,
  must_change_password   TINYINT(1) NOT NULL DEFAULT 1,
  is_active              TINYINT(1) NOT NULL DEFAULT 1,
  failed_login_attempts  INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until           DATETIME NULL,
  last_login_at          DATETIME NULL,
  created_by             BIGINT UNSIGNED NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_telephone (telephone),
  KEY idx_users_role (role),
  CONSTRAINT chk_users_identifiant CHECK (email IS NOT NULL OR telephone IS NOT NULL),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_token (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Une seule ligne (id = 1) : identité de l'établissement
CREATE TABLE school_settings (
  id                     TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  nom                    VARCHAR(190) NOT NULL,
  logo_path              VARCHAR(255) NULL,
  adresse                VARCHAR(255) NULL,
  telephone              VARCHAR(30)  NULL,
  email                  VARCHAR(190) NULL,
  devise                 VARCHAR(10)  NOT NULL DEFAULT 'FCFA',
  note_max               DECIMAL(4,2) NOT NULL DEFAULT 20.00,
  duree_heure_minutes    SMALLINT UNSIGNED NOT NULL DEFAULT 55,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_school_single CHECK (id = 1)
) ENGINE=InnoDB;

-- Compteurs pour matricules et numéros de reçus (ex: MAT-2026-00012, REC-2026-000045)
CREATE TABLE sequences (
  name        VARCHAR(50) NOT NULL,
  year        SMALLINT UNSIGNED NOT NULL,
  `last_value`  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (name, year)
) ENGINE=InnoDB;

-- =====================================================================
-- 2. STRUCTURE ACADÉMIQUE
-- =====================================================================

CREATE TABLE academic_years (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  libelle     VARCHAR(20) NOT NULL,               -- ex: 2026-2027
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  is_current  TINYINT(1) NOT NULL DEFAULT 0,      -- une seule année courante (garantie par le service)
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_year_libelle (libelle),
  CONSTRAINT chk_year_dates CHECK (date_fin > date_debut)
) ENGINE=InnoDB;

CREATE TABLE cycles (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL,             -- Primaire, Collège...
  description  VARCHAR(255) NULL,
  ordre        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cycle_nom (nom)
) ENGINE=InnoDB;

CREATE TABLE classes (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cycle_id   BIGINT UNSIGNED NOT NULL,
  nom        VARCHAR(100) NOT NULL,               -- CP1, CP2, 6ème...
  ordre      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_cycle_nom (cycle_id, nom),
  CONSTRAINT fk_class_cycle FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE class_aliases (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id   BIGINT UNSIGNED NOT NULL,
  nom        VARCHAR(100) NOT NULL,               -- CP1 A, CP1 B...
  capacite   SMALLINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_alias_class_nom (class_id, nom),
  CONSTRAINT fk_alias_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE subjects (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(120) NOT NULL,              -- Maths, Calcul écrit...
  code        VARCHAR(20)  NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_nom (nom)
) ENGINE=InnoDB;

-- Matière affectée à une classe + coefficient dans cette classe
CREATE TABLE class_subjects (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id     BIGINT UNSIGNED NOT NULL,
  subject_id   BIGINT UNSIGNED NOT NULL,
  coefficient  DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_subject (class_id, subject_id),
  CONSTRAINT chk_coef CHECK (coefficient > 0),
  CONSTRAINT fk_cs_class   FOREIGN KEY (class_id)   REFERENCES classes(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Professeur ↔ matière (d'une classe) ↔ alias, pour une année
-- Règle appliquée par le service : alias.class_id = class_subjects.class_id
CREATE TABLE teacher_assignments (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id   BIGINT UNSIGNED NOT NULL,
  teacher_id         BIGINT UNSIGNED NOT NULL,    -- users.id (role PROFESSEUR)
  class_subject_id   BIGINT UNSIGNED NOT NULL,
  class_alias_id     BIGINT UNSIGNED NOT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assign (academic_year_id, class_subject_id, class_alias_id),
  KEY idx_assign_teacher (teacher_id, academic_year_id),
  CONSTRAINT fk_ta_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ta_teacher FOREIGN KEY (teacher_id)       REFERENCES users(id)          ON DELETE RESTRICT,
  CONSTRAINT fk_ta_cs      FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ta_alias   FOREIGN KEY (class_alias_id)   REFERENCES class_aliases(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 3. FRAIS DE SCOLARITÉ
-- =====================================================================

CREATE TABLE tuition_fees (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id    BIGINT UNSIGNED NOT NULL,
  class_id            BIGINT UNSIGNED NOT NULL,
  frais_inscription   DECIMAL(12,2) NOT NULL DEFAULT 0,
  montant_scolarite   DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fee (academic_year_id, class_id),
  CONSTRAINT chk_fee_pos CHECK (frais_inscription >= 0 AND montant_scolarite >= 0),
  CONSTRAINT fk_fee_year  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_fee_class FOREIGN KEY (class_id)         REFERENCES classes(id)        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Modalités de paiement autorisées (cases cochées par le Directeur)
CREATE TABLE tuition_fee_modalities (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tuition_fee_id  BIGINT UNSIGNED NOT NULL,
  modalite        ENUM('JOURNALIER','HEBDOMADAIRE','MENSUEL','TRIMESTRIEL','SEMESTRIEL') NOT NULL,
  UNIQUE KEY uq_fee_modalite (tuition_fee_id, modalite),
  CONSTRAINT fk_fm_fee FOREIGN KEY (tuition_fee_id) REFERENCES tuition_fees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 4. ÉLÈVES, TUTEURS, INSCRIPTIONS
-- =====================================================================

CREATE TABLE guardians (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT UNSIGNED NULL,       -- compte Parent associé
  nom                 VARCHAR(100) NOT NULL,
  prenom              VARCHAR(100) NOT NULL,
  telephone_whatsapp  VARCHAR(30)  NOT NULL,
  email               VARCHAR(190) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guardian_phone (telephone_whatsapp),
  CONSTRAINT fk_guardian_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE students (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matricule        VARCHAR(30) NOT NULL,
  nom              VARCHAR(100) NOT NULL,
  prenom           VARCHAR(100) NOT NULL,
  sexe             ENUM('M','F') NULL,
  date_naissance   DATE NOT NULL,
  lieu_naissance   VARCHAR(150) NOT NULL,
  adresse          VARCHAR(255) NOT NULL,          -- adresse du domicile
  photo_path       VARCHAR(255) NULL,
  guardian_id      BIGINT UNSIGNED NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_matricule (matricule),
  KEY idx_student_nom (nom, prenom),
  KEY idx_student_guardian (guardian_id),
  CONSTRAINT fk_student_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Inscription d'un élève pour une année (porte la classe, l'alias et la modalité de paiement)
CREATE TABLE enrollments (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id          BIGINT UNSIGNED NOT NULL,
  academic_year_id    BIGINT UNSIGNED NOT NULL,
  class_id            BIGINT UNSIGNED NOT NULL,
  class_alias_id      BIGINT UNSIGNED NOT NULL,
  modalite_paiement   ENUM('JOURNALIER','HEBDOMADAIRE','MENSUEL','TRIMESTRIEL','SEMESTRIEL') NOT NULL,
  frais_inscription   DECIMAL(12,2) NOT NULL,      -- figé au moment de l'inscription
  montant_scolarite   DECIMAL(12,2) NOT NULL,      -- figé au moment de l'inscription
  statut              ENUM('EN_ATTENTE','INSCRIT','ANNULE') NOT NULL DEFAULT 'EN_ATTENTE',
  date_inscription    DATE NOT NULL,
  created_by          BIGINT UNSIGNED NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enroll (student_id, academic_year_id),
  KEY idx_enroll_alias (class_alias_id, academic_year_id),
  KEY idx_enroll_class (class_id, academic_year_id),
  CONSTRAINT fk_en_student FOREIGN KEY (student_id)       REFERENCES students(id)       ON DELETE RESTRICT,
  CONSTRAINT fk_en_year    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_en_class   FOREIGN KEY (class_id)         REFERENCES classes(id)        ON DELETE RESTRICT,
  CONSTRAINT fk_en_alias   FOREIGN KEY (class_alias_id)   REFERENCES class_aliases(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_en_creator FOREIGN KEY (created_by)       REFERENCES users(id)          ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 5. PAIEMENTS, ÉCHÉANCIER, RELANCES
-- =====================================================================

-- Échéancier généré à partir de la modalité choisie
CREATE TABLE payment_schedules (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id   BIGINT UNSIGNED NOT NULL,
  numero          SMALLINT UNSIGNED NOT NULL,
  date_echeance   DATE NOT NULL,
  montant_du      DECIMAL(12,2) NOT NULL,
  montant_paye    DECIMAL(12,2) NOT NULL DEFAULT 0,
  statut          ENUM('A_PAYER','PARTIEL','PAYE') NOT NULL DEFAULT 'A_PAYER',
  UNIQUE KEY uq_schedule (enrollment_id, numero),
  KEY idx_schedule_due (date_echeance, statut),
  CONSTRAINT fk_sch_enroll FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payments (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id          BIGINT UNSIGNED NOT NULL,
  type                   ENUM('INSCRIPTION','SCOLARITE') NOT NULL,
  montant                DECIMAL(12,2) NOT NULL,
  moyen                  ENUM('ESPECES','FLOOZ','MIXX_BY_YAS') NOT NULL,
  reference_transaction  VARCHAR(100) NULL,        -- n° de transaction mobile money
  numero_recu            VARCHAR(30) NOT NULL,
  date_paiement          DATETIME NOT NULL,
  statut                 ENUM('VALIDE','ANNULE') NOT NULL DEFAULT 'VALIDE',
  motif_annulation       VARCHAR(255) NULL,
  created_by             BIGINT UNSIGNED NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_recu (numero_recu),
  KEY idx_payment_enroll (enrollment_id, type, statut),
  KEY idx_payment_date (date_paiement),
  CONSTRAINT chk_payment_pos CHECK (montant > 0),
  CONSTRAINT fk_pay_enroll  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_creator FOREIGN KEY (created_by)    REFERENCES users(id)       ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Ventilation d'un paiement de scolarité sur les échéances
CREATE TABLE payment_allocations (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id    BIGINT UNSIGNED NOT NULL,
  schedule_id   BIGINT UNSIGNED NOT NULL,
  montant       DECIMAL(12,2) NOT NULL,
  KEY idx_alloc_payment (payment_id),
  KEY idx_alloc_schedule (schedule_id),
  CONSTRAINT fk_alloc_payment  FOREIGN KEY (payment_id)  REFERENCES payments(id)          ON DELETE CASCADE,
  CONSTRAINT fk_alloc_schedule FOREIGN KEY (schedule_id) REFERENCES payment_schedules(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Historique des relances envoyées aux parents
CREATE TABLE payment_reminders (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id   BIGINT UNSIGNED NOT NULL,
  schedule_id     BIGINT UNSIGNED NULL,
  canal           ENUM('NOTIFICATION','EMAIL','WHATSAPP') NOT NULL,
  message         TEXT NOT NULL,
  statut          ENUM('ENVOYE','ECHEC') NOT NULL DEFAULT 'ENVOYE',
  sent_by         BIGINT UNSIGNED NOT NULL,
  sent_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rem_enroll (enrollment_id, sent_at),
  CONSTRAINT fk_rem_enroll   FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)       ON DELETE CASCADE,
  CONSTRAINT fk_rem_schedule FOREIGN KEY (schedule_id)   REFERENCES payment_schedules(id) ON DELETE SET NULL,
  CONSTRAINT fk_rem_sender   FOREIGN KEY (sent_by)       REFERENCES users(id)             ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 6. ÉVALUATIONS ET NOTES
-- =====================================================================

-- Périodes d'évaluation (Trimestre 1, 2, 3 / Semestre 1, 2) + FENÊTRE DE SAISIE des notes
CREATE TABLE evaluation_periods (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id  BIGINT UNSIGNED NOT NULL,
  libelle           VARCHAR(60) NOT NULL,
  ordre             SMALLINT UNSIGNED NOT NULL,
  date_debut        DATE NOT NULL,
  date_fin          DATE NOT NULL,
  saisie_debut      DATETIME NULL,                -- les profs ne peuvent PAS saisir avant
  saisie_fin        DATETIME NULL,                -- ni APRÈS
  UNIQUE KEY uq_period (academic_year_id, ordre),
  CONSTRAINT chk_period_saisie CHECK (saisie_fin IS NULL OR saisie_debut IS NULL OR saisie_fin > saisie_debut),
  CONSTRAINT fk_ep_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Une ligne par (élève, matière de la classe, période) : colonnes Interro / Devoir / Compo
CREATE TABLE grades (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id          BIGINT UNSIGNED NOT NULL,
  class_subject_id       BIGINT UNSIGNED NOT NULL,
  evaluation_period_id   BIGINT UNSIGNED NOT NULL,
  interro                DECIMAL(4,2) NULL,
  devoir                 DECIMAL(4,2) NULL,
  compo                  DECIMAL(4,2) NULL,
  appreciation           VARCHAR(255) NULL,
  entered_by             BIGINT UNSIGNED NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_grade (enrollment_id, class_subject_id, evaluation_period_id),
  KEY idx_grade_cs_period (class_subject_id, evaluation_period_id),
  CONSTRAINT chk_grade_range CHECK (
    (interro IS NULL OR interro BETWEEN 0 AND 20) AND
    (devoir  IS NULL OR devoir  BETWEEN 0 AND 20) AND
    (compo   IS NULL OR compo   BETWEEN 0 AND 20)),
  CONSTRAINT fk_gr_enroll  FOREIGN KEY (enrollment_id)        REFERENCES enrollments(id)        ON DELETE CASCADE,
  CONSTRAINT fk_gr_cs      FOREIGN KEY (class_subject_id)     REFERENCES class_subjects(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_gr_period  FOREIGN KEY (evaluation_period_id) REFERENCES evaluation_periods(id) ON DELETE RESTRICT,
  CONSTRAINT fk_gr_user    FOREIGN KEY (entered_by)           REFERENCES users(id)              ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- 7. EMPLOI DU TEMPS ET PRÉSENCES
-- =====================================================================

-- Créneau récurrent hebdomadaire. Durée = nb_heures × 55 min (heure_fin calculée par le service)
CREATE TABLE timetable_slots (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id       BIGINT UNSIGNED NOT NULL,
  class_alias_id         BIGINT UNSIGNED NOT NULL,
  teacher_assignment_id  BIGINT UNSIGNED NOT NULL,   -- donne professeur + matière + alias
  jour_semaine           TINYINT UNSIGNED NOT NULL,  -- 1 = lundi ... 7 = dimanche
  heure_debut            TIME NOT NULL,
  heure_fin              TIME NOT NULL,
  nb_heures              TINYINT UNSIGNED NOT NULL DEFAULT 1,
  salle                  VARCHAR(50) NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_slot_alias (academic_year_id, class_alias_id, jour_semaine),
  KEY idx_slot_assign (teacher_assignment_id, jour_semaine),
  CONSTRAINT chk_slot_day  CHECK (jour_semaine BETWEEN 1 AND 7),
  CONSTRAINT chk_slot_time CHECK (heure_fin > heure_debut),
  CONSTRAINT fk_slot_year   FOREIGN KEY (academic_year_id)      REFERENCES academic_years(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_slot_alias  FOREIGN KEY (class_alias_id)        REFERENCES class_aliases(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_slot_assign FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Une séance d'appel (un cours donné à une date)
CREATE TABLE attendance_sessions (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_assignment_id  BIGINT UNSIGNED NOT NULL,
  timetable_slot_id      BIGINT UNSIGNED NULL,
  date_cours             DATE NOT NULL,
  heure_debut            TIME NULL,
  created_by             BIGINT UNSIGNED NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session (teacher_assignment_id, date_cours, heure_debut),
  CONSTRAINT fk_as_assign FOREIGN KEY (teacher_assignment_id) REFERENCES teacher_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_slot   FOREIGN KEY (timetable_slot_id)     REFERENCES timetable_slots(id)     ON DELETE SET NULL,
  CONSTRAINT fk_as_user   FOREIGN KEY (created_by)            REFERENCES users(id)               ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE attendance_records (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id       BIGINT UNSIGNED NOT NULL,
  enrollment_id    BIGINT UNSIGNED NOT NULL,
  statut           ENUM('PRESENT','ABSENT','RETARD') NOT NULL,
  minutes_retard   SMALLINT UNSIGNED NULL,         -- obligatoire si statut = RETARD
  justification    VARCHAR(255) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance (session_id, enrollment_id),
  KEY idx_att_enroll (enrollment_id, statut),
  CONSTRAINT chk_retard CHECK (statut <> 'RETARD' OR minutes_retard > 0),
  CONSTRAINT fk_ar_session FOREIGN KEY (session_id)    REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_enroll  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)         ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 8. COMMUNIQUÉS, NOTIFICATIONS, AUDIT, SAUVEGARDES
-- =====================================================================

CREATE TABLE announcements (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titre       VARCHAR(200) NOT NULL,
  contenu     TEXT NOT NULL,
  auteur_id   BIGINT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ann_author FOREIGN KEY (auteur_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Cibles d'un communiqué : un communiqué peut avoir plusieurs cibles
CREATE TABLE announcement_targets (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  announcement_id  BIGINT UNSIGNED NOT NULL,
  target_type      ENUM('TOUS','ROLE','CYCLE','CLASSE','ALIAS') NOT NULL,
  role             ENUM('SECRETAIRE','COMPTABLE','PROFESSEUR','PARENT') NULL,
  cycle_id         BIGINT UNSIGNED NULL,
  class_id         BIGINT UNSIGNED NULL,
  class_alias_id   BIGINT UNSIGNED NULL,
  KEY idx_target_ann (announcement_id),
  CONSTRAINT fk_tg_ann   FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_tg_cycle FOREIGN KEY (cycle_id)        REFERENCES cycles(id)        ON DELETE CASCADE,
  CONSTRAINT fk_tg_class FOREIGN KEY (class_id)        REFERENCES classes(id)       ON DELETE CASCADE,
  CONSTRAINT fk_tg_alias FOREIGN KEY (class_alias_id)  REFERENCES class_aliases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Notifications internes (cloche de la topbar). Le communiqué, les absences,
-- les relances, etc. génèrent une ligne par destinataire.
CREATE TABLE notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        ENUM('COMMUNIQUE','SCOLARITE','RELANCE','ABSENCE','RETARD','PRESENCE','SYSTEME') NOT NULL,
  titre       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  data        JSON NULL,                           -- ex: {"studentId": 12, "enrollmentId": 30}
  read_at     DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_user (user_id, read_at, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,
  action       VARCHAR(60) NOT NULL,               -- LOGIN, LOGIN_FAILED, CREATE, UPDATE, DELETE, PAYMENT_CANCEL...
  entity       VARCHAR(60) NULL,
  entity_id    BIGINT UNSIGNED NULL,
  old_values   JSON NULL,
  new_values   JSON NULL,
  ip_address   VARCHAR(45) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_user (user_id, created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Trace des sauvegardes (le fichier lui-même est téléchargé, jamais conservé sur le serveur)
CREATE TABLE backup_logs (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academic_year_id   BIGINT UNSIGNED NOT NULL,
  format             ENUM('SQL','JSON') NOT NULL,
  taille_octets      BIGINT UNSIGNED NULL,
  created_by         BIGINT UNSIGNED NOT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bk_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bk_user FOREIGN KEY (created_by)       REFERENCES users(id)          ON DELETE RESTRICT
) ENGINE=InnoDB;
