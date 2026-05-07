import '../../styles/hyeni-theme.css';

export function HyPage({ children, withBottomNav = true, className = '' }) {
  return (
    <main className={`hy-page ${withBottomNav ? 'hy-page--with-nav' : ''} ${className}`}>
      {children}
    </main>
  );
}
