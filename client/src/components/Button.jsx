// Bouton unique du design system.
export default function Button({
  children,
  variant = 'primary',
  size,
  type = 'button',
  className = '',
  ...props
}) {
  const classes = ['btn', `btn-${variant}`];
  if (size) classes.push(`btn-${size}`);
  if (className) classes.push(className);
  return (
    <button type={type} className={classes.join(' ')} {...props}>
      {children}
    </button>
  );
}
