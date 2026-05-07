const DEFAULT_ITEMS = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'calendar', label: '일정', icon: '🗓️' },
  { key: 'child', label: '우리아이', icon: '👧' },
  { key: 'memo', label: '메모', icon: '📝' },
  { key: 'family', label: '가족', icon: '👨‍👩‍👧' },
];

export function HyBottomNav({ active = 'home', items = DEFAULT_ITEMS, onSelect }) {
  return (
    <nav className="hy-bottom-nav" aria-label="하단 내비게이션">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="hy-bottom-nav__item"
          data-active={item.key === active}
          aria-current={item.key === active ? 'page' : undefined}
          onClick={() => onSelect?.(item.key)}
        >
          <span className="hy-bottom-nav__icon" aria-hidden="true">{item.icon}</span>
          <div>{item.label}</div>
        </button>
      ))}
    </nav>
  );
}
