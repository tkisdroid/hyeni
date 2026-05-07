export function HyButton({ children, variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={`hy-button hy-button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
