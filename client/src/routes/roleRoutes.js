// Correspondance rôle -> tableau de bord + libellés, partagée entre
// le contexte d'authentification et le routeur.
export const ROLE_DASHBOARD = {
  ADMIN: '/admin',
  DIRECTEUR: '/directeur',
  SECRETAIRE: '/secretaire',
  COMPTABLE: '/comptable',
  PROFESSEUR: '/professeur',
  PARENT: '/parent',
};

export const ROLE_ESPACE = {
  ADMIN: 'Espace Administrateur',
  DIRECTEUR: 'Espace Directeur',
  SECRETAIRE: 'Espace Secrétaire',
  COMPTABLE: 'Espace Comptable',
  PROFESSEUR: 'Espace Professeur',
  PARENT: 'Espace Parent',
};

export const ROLE_COULEUR = {
  ADMIN: 'bleu',
  DIRECTEUR: 'bleu',
  SECRETAIRE: 'vert',
  COMPTABLE: 'jaune',
  PROFESSEUR: 'bleu',
  PARENT: 'vert',
};
