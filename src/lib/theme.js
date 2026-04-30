// src/lib/theme.js
//
// v1.1 Theme System library.
//
// 6 preset themes selectable at signup (or later in settings). Each theme
// defines 8 CSS variables (--th-*) that DESIGN.colors / DESIGN.gradients in
// App.jsx reference via var(--th-*). Safety colors (--safe-*) and category
// colors (--cat-*) live in src/theme.css :root and are NEVER overridden by
// themes — see memory: design_color_rules and SPEC §4.2.
//
// Public API:
//   THEMES                — frozen catalog of 6 themes (id → {name, tokens})
//   DEFAULT_THEME_ID      — 'warm-pink' (current pink identity)
//   isValidThemeId(id)    — guard for ID coming from DB / user input
//   applyTheme(id)        — write all --th-* variables to :root, returns applied id
//   subscribeFamilyTheme(familyId, supabase, onChange)
//                         — Realtime channel that calls applyTheme() on UPDATE.
//                           Returns an unsubscribe function (or null on bad input).

export const DEFAULT_THEME_ID = 'warm-pink';

export const THEMES = Object.freeze({
  'warm-pink': Object.freeze({
    name: '따뜻한 핑크',
    tokens: Object.freeze({
      primary: '#F779A8',
      deep: '#E65C92',
      text: '#B0477A',
      soft: '#FFF5FA',
      line: '#FFE4EF',
      'line-strong': '#FFD4E7',
      'grad-primary': 'linear-gradient(135deg, #F779A8 0%, #E65C92 100%)',
      'grad-shell': 'radial-gradient(240px 160px at 10% 0%, rgba(255,200,220,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(255,225,180,0.60) 0%, transparent 60%), #FFFAF5',
    }),
  }),
  'soft-lavender': Object.freeze({
    name: '부드러운 라벤더',
    tokens: Object.freeze({
      primary: '#A78BFA',
      deep: '#7C3AED',
      text: '#6D28D9',
      soft: '#F5F3FF',
      line: '#EDE9FE',
      'line-strong': '#DDD6FE',
      'grad-primary': 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
      'grad-shell': 'radial-gradient(240px 160px at 10% 0%, rgba(196,181,253,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(221,214,254,0.60) 0%, transparent 60%), #F8F6FF',
    }),
  }),
  'mint-fresh': Object.freeze({
    name: '상쾌한 민트',
    tokens: Object.freeze({
      primary: '#10B981',
      deep: '#059669',
      text: '#047857',
      soft: '#ECFDF5',
      line: '#D1FAE5',
      'line-strong': '#A7F3D0',
      'grad-primary': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      'grad-shell': 'radial-gradient(240px 160px at 10% 0%, rgba(167,243,208,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(209,250,229,0.60) 0%, transparent 60%), #F4FFF9',
    }),
  }),
  'sky-blue': Object.freeze({
    name: '맑은 하늘',
    tokens: Object.freeze({
      primary: '#3B82F6',
      deep: '#2563EB',
      text: '#1D4ED8',
      soft: '#EFF6FF',
      line: '#DBEAFE',
      'line-strong': '#BFDBFE',
      'grad-primary': 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
      'grad-shell': 'radial-gradient(240px 160px at 10% 0%, rgba(191,219,254,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(219,234,254,0.60) 0%, transparent 60%), #F5FAFF',
    }),
  }),
  'sunny-amber': Object.freeze({
    name: '햇살 amber',
    tokens: Object.freeze({
      primary: '#F59E0B',
      deep: '#D97706',
      text: '#B45309',
      soft: '#FFFBEB',
      line: '#FEF3C7',
      'line-strong': '#FDE68A',
      'grad-primary': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
      'grad-shell': 'radial-gradient(240px 160px at 10% 0%, rgba(253,230,138,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(254,243,199,0.60) 0%, transparent 60%), #FFFBF0',
    }),
  }),
  'cool-charcoal': Object.freeze({
    name: '차분한 차콜',
    tokens: Object.freeze({
      primary: '#475569',
      deep: '#334155',
      text: '#1E293B',
      soft: '#F8FAFC',
      line: '#E2E8F0',
      'line-strong': '#CBD5E1',
      'grad-primary': 'linear-gradient(135deg, #475569 0%, #334155 100%)',
      'grad-shell': 'radial-gradient(240px 160px at 10% 0%, rgba(203,213,225,0.80) 0%, transparent 60%), radial-gradient(240px 200px at 100% 100%, rgba(226,232,240,0.60) 0%, transparent 60%), #F8FAFC',
    }),
  }),
});

export const THEME_IDS = Object.freeze(Object.keys(THEMES));

export function isValidThemeId(themeId) {
  return typeof themeId === 'string' && Object.prototype.hasOwnProperty.call(THEMES, themeId);
}

export function applyTheme(themeId) {
  const id = isValidThemeId(themeId) ? themeId : DEFAULT_THEME_ID;
  const theme = THEMES[id];
  if (typeof document === 'undefined') return id;
  const root = document.documentElement;
  if (!root) return id;
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--th-${key}`, value);
  }
  root.dataset.theme = id;
  return id;
}

export function subscribeFamilyTheme(familyId, supabase, onChange) {
  if (!familyId || !supabase || typeof supabase.channel !== 'function') {
    return null;
  }
  const channel = supabase
    .channel(`family-theme:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'families',
        filter: `id=eq.${familyId}`,
      },
      (payload) => {
        const newTheme = payload?.new?.theme;
        const oldTheme = payload?.old?.theme;
        if (newTheme && newTheme !== oldTheme) {
          const applied = applyTheme(newTheme);
          if (typeof onChange === 'function') {
            try { onChange(applied); } catch (e) { console.error('[theme] onChange threw', e); }
          }
        }
      }
    )
    .subscribe();
  return () => {
    try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
  };
}
