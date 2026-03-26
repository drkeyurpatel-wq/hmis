/**
 * Task 1.1 — Design System Token Tests
 * RED: These tests define the contract for Health1 brand tokens.
 * They MUST fail before implementation (no tokens exist yet).
 * GREEN: Pass after tailwind.config.ts is updated.
 */
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../tailwind.config';

const fullConfig = resolveConfig(tailwindConfig);
const colors = fullConfig.theme.colors as Record<string, any>;

describe('Health1 Design System — Brand Color Tokens', () => {
  // Brand colors from Health1 logo
  test('h1-navy exists with correct hex', () => {
    expect(colors['h1-navy']).toBeDefined();
    expect(colors['h1-navy'].DEFAULT).toBe('#1A2E5A');
    expect(colors['h1-navy'].light).toBe('#E8EDF5');
  });

  test('h1-teal exists with correct hex', () => {
    expect(colors['h1-teal']).toBeDefined();
    expect(colors['h1-teal'].DEFAULT).toBe('#00A19A');
    expect(colors['h1-teal'].light).toBe('#E6F7F6');
  });

  test('h1-red exists with correct hex', () => {
    expect(colors['h1-red']).toBeDefined();
    expect(colors['h1-red'].DEFAULT).toBe('#D42B2B');
    expect(colors['h1-red'].light).toBe('#FDE8E8');
  });

  test('h1-yellow exists with correct hex', () => {
    expect(colors['h1-yellow']).toBeDefined();
    expect(colors['h1-yellow'].DEFAULT).toBe('#E8A817');
    expect(colors['h1-yellow'].light).toBe('#FEF6E0');
  });

  // Functional colors
  test('h1-success exists', () => {
    expect(colors['h1-success']).toBe('#16A34A');
  });

  test('h1-bg, h1-card, h1-border exist', () => {
    expect(colors['h1-bg']).toBe('#F8FAFC');
    expect(colors['h1-card']).toBe('#FFFFFF');
    expect(colors['h1-border']).toBe('#E2E8F0');
  });

  test('h1-text scale exists with 3 levels', () => {
    expect(colors['h1-text']).toBeDefined();
    expect(colors['h1-text'].DEFAULT).toBe('#1E293B');
    expect(colors['h1-text'].secondary).toBe('#64748B');
    expect(colors['h1-text'].muted).toBe('#94A3B8');
  });

  // Ensure no old ad-hoc colors leaked in
  test('all 16 token keys exist', () => {
    const requiredKeys = [
      'h1-navy', 'h1-teal', 'h1-red', 'h1-yellow',
      'h1-success', 'h1-bg', 'h1-card', 'h1-border', 'h1-text',
    ];
    for (const key of requiredKeys) {
      expect(colors[key]).toBeDefined();
    }
  });
});

describe('Health1 Design System — Typography', () => {
  test('Inter is configured as default sans font', () => {
    const fontFamily = fullConfig.theme.fontFamily as Record<string, string[]>;
    expect(fontFamily.sans).toBeDefined();
    expect(fontFamily.sans[0]).toMatch(/Inter/i);
  });
});

describe('Health1 Design System — Breakpoints', () => {
  const screens = fullConfig.theme.screens as Record<string, string>;

  test('sm breakpoint is 375px (small phone)', () => {
    expect(screens.sm).toBe('375px');
  });

  test('md breakpoint is 768px (tablet)', () => {
    expect(screens.md).toBe('768px');
  });

  test('lg breakpoint is 1024px (laptop)', () => {
    expect(screens.lg).toBe('1024px');
  });

  test('xl breakpoint is 1440px (desktop)', () => {
    expect(screens.xl).toBe('1440px');
  });
});
