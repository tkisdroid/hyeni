export function HyCard({ children, className = '', onClick, ...props }) {
  const interactiveProps = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') onClick(event);
        },
      }
    : {};

  return (
    <section className={`hy-card ${className}`} {...interactiveProps} {...props}>
      {children}
    </section>
  );
}
