import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THEMES,
  THEME_IDS,
  DEFAULT_THEME_ID,
  isValidThemeId,
  applyTheme,
  subscribeFamilyTheme,
} from '../src/lib/theme.js';

const REQUIRED_TOKENS = ['primary', 'deep', 'text', 'soft', 'line', 'line-strong', 'grad-primary', 'grad-shell'];

describe('THEMES catalog', () => {
  it('has exactly 6 themes', () => {
    expect(Object.keys(THEMES)).toHaveLength(6);
    expect(THEME_IDS).toHaveLength(6);
  });

  it('matches the families_theme_check constraint IDs', () => {
    expect(new Set(THEME_IDS)).toEqual(new Set([
      'warm-pink',
      'soft-lavender',
      'mint-fresh',
      'sky-blue',
      'sunny-amber',
      'cool-charcoal',
    ]));
  });

  it('every theme has all 8 required tokens', () => {
    Object.entries(THEMES).forEach(([id, theme]) => {
      REQUIRED_TOKENS.forEach((key) => {
        expect(theme.tokens[key], `${id}.${key}`).toBeTruthy();
      });
    });
  });

  it('every theme exposes a name in Korean', () => {
    Object.values(THEMES).forEach((theme) => {
      expect(typeof theme.name).toBe('string');
      expect(theme.name.length).toBeGreaterThan(0);
    });
  });

  it('default theme is warm-pink and matches current pink identity', () => {
    expect(DEFAULT_THEME_ID).toBe('warm-pink');
    expect(THEMES[DEFAULT_THEME_ID].tokens.primary).toBe('#F779A8');
  });

  it('THEMES is frozen', () => {
    expect(Object.isFrozen(THEMES)).toBe(true);
    expect(Object.isFrozen(THEMES['warm-pink'])).toBe(true);
    expect(Object.isFrozen(THEMES['warm-pink'].tokens)).toBe(true);
  });
});

describe('isValidThemeId', () => {
  it('accepts every catalog ID', () => {
    THEME_IDS.forEach((id) => expect(isValidThemeId(id)).toBe(true));
  });

  it('rejects unknown / non-string / falsy IDs', () => {
    expect(isValidThemeId('purple')).toBe(false);
    expect(isValidThemeId('')).toBe(false);
    expect(isValidThemeId(null)).toBe(false);
    expect(isValidThemeId(undefined)).toBe(false);
    expect(isValidThemeId(123)).toBe(false);
    expect(isValidThemeId({})).toBe(false);
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    const root = document.documentElement;
    REQUIRED_TOKENS.forEach((key) => root.style.removeProperty(`--th-${key}`));
    delete root.dataset.theme;
  });

  it('writes all 8 --th-* variables for a valid theme', () => {
    applyTheme('mint-fresh');
    const root = document.documentElement;
    REQUIRED_TOKENS.forEach((key) => {
      expect(root.style.getPropertyValue(`--th-${key}`), `--th-${key}`).toBeTruthy();
    });
  });

  it('sets data-theme attribute on documentElement', () => {
    applyTheme('sky-blue');
    expect(document.documentElement.dataset.theme).toBe('sky-blue');
  });

  it('falls back to default theme for unknown ID', () => {
    const result = applyTheme('unknown-theme');
    expect(result).toBe(DEFAULT_THEME_ID);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
  });

  it('falls back to default for null/undefined input', () => {
    expect(applyTheme(null)).toBe(DEFAULT_THEME_ID);
    expect(applyTheme(undefined)).toBe(DEFAULT_THEME_ID);
  });

  it('returns the applied theme ID', () => {
    expect(applyTheme('sunny-amber')).toBe('sunny-amber');
    expect(applyTheme('cool-charcoal')).toBe('cool-charcoal');
  });

  it('switches themes by overwriting variables', () => {
    applyTheme('warm-pink');
    const pinkPrimary = document.documentElement.style.getPropertyValue('--th-primary');
    applyTheme('mint-fresh');
    const mintPrimary = document.documentElement.style.getPropertyValue('--th-primary');
    expect(pinkPrimary).not.toBe(mintPrimary);
    expect(mintPrimary.toLowerCase().trim()).toBe('#10b981');
  });
});

describe('subscribeFamilyTheme', () => {
  it('returns null on missing inputs', () => {
    expect(subscribeFamilyTheme(null, {})).toBeNull();
    expect(subscribeFamilyTheme('fam-1', null)).toBeNull();
    expect(subscribeFamilyTheme('fam-1', {})).toBeNull();
  });

  it('subscribes to family-theme:{id} channel with correct filter', () => {
    let registered = null;
    const subscribe = vi.fn();
    const on = vi.fn((event, opts, handler) => {
      registered = { event, opts, handler };
      return { subscribe };
    });
    const channel = vi.fn(() => ({ on }));
    const removeChannel = vi.fn();
    const supabase = { channel, removeChannel };

    const unsub = subscribeFamilyTheme('fam-1', supabase);

    expect(channel).toHaveBeenCalledWith('family-theme:fam-1');
    expect(registered.event).toBe('postgres_changes');
    expect(registered.opts).toMatchObject({
      event: 'UPDATE',
      schema: 'public',
      table: 'families',
      filter: 'id=eq.fam-1',
    });
    expect(subscribe).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('applies new theme and calls onChange on UPDATE event', () => {
    let registeredHandler = null;
    const on = vi.fn((event, opts, handler) => {
      registeredHandler = handler;
      return { subscribe: vi.fn() };
    });
    const supabase = { channel: vi.fn(() => ({ on })), removeChannel: vi.fn() };
    const onChange = vi.fn();

    subscribeFamilyTheme('fam-1', supabase, onChange);
    delete document.documentElement.dataset.theme;
    registeredHandler({ new: { theme: 'sky-blue' }, old: { theme: 'warm-pink' } });

    expect(document.documentElement.dataset.theme).toBe('sky-blue');
    expect(onChange).toHaveBeenCalledWith('sky-blue');
  });

  it('ignores UPDATE when theme did not change', () => {
    let registeredHandler = null;
    const on = vi.fn((event, opts, handler) => {
      registeredHandler = handler;
      return { subscribe: vi.fn() };
    });
    const supabase = { channel: vi.fn(() => ({ on })), removeChannel: vi.fn() };
    const onChange = vi.fn();

    subscribeFamilyTheme('fam-1', supabase, onChange);
    registeredHandler({ new: { theme: 'warm-pink' }, old: { theme: 'warm-pink' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the channel', () => {
    const removeChannel = vi.fn();
    const channelObj = { on: vi.fn(() => ({ subscribe: vi.fn(() => 'CHANNEL') })) };
    const supabase = { channel: vi.fn(() => channelObj), removeChannel };

    const unsub = subscribeFamilyTheme('fam-1', supabase);
    unsub();

    expect(removeChannel).toHaveBeenCalled();
  });
});
