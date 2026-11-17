// Badge d'état. couleur : bleu | vert | rouge | jaune | gris
export default function Badge({ couleur = 'gris', children }) {
  return <span className={`badge badge-${couleur}`}>{children}</span>;
}
