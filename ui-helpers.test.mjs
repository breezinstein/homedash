import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryId } from './src/lib/slug.ts';
import { themeType } from './src/lib/themeType.ts';

const darkColors = {
  primary: '#6366f1',
  secondary: '#475569',
  background: '#0a0a0a',
  surface: '#1a1a1a',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  border: '#27272a',
  accent: '#8b5cf6',
  success: '#22c55e',
  warning: '#eab308',
  error: '#f87171',
};

const lightColors = {
  ...darkColors,
  background: '#f8fafc',
  surface: '#ffffff',
  textPrimary: '#0f172a',
};

test('categoryId is a stable, URL-safe anchor', () => {
  assert.equal(categoryId('Media'), 'cat-media');
  assert.equal(categoryId('Content & Knowledge'), 'cat-content-knowledge');
  assert.equal(categoryId('  A.I. @ Home  '), 'cat-a-i-home');
  // Same input, same id: the sidebar jump links rely on this.
  assert.equal(categoryId('System'), categoryId('system'));
});

test('themeType trusts the preset name over the colours', () => {
  // A user can hand-edit colours; the chosen preset still says what it is.
  assert.equal(themeType('Default Light', darkColors), 'light');
  assert.equal(themeType('Default Dark', lightColors), 'dark');
  assert.equal(themeType('Catppuccin Mocha', darkColors), 'dark');
});

test('themeType infers from the background when no preset matches', () => {
  assert.equal(themeType('custom', darkColors), 'dark');
  assert.equal(themeType('custom', lightColors), 'light');
  assert.equal(themeType(undefined, { ...darkColors, background: '#fff' }), 'light');
});
