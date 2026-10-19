import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// Polyfill window.matchMedia for JSDOM
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfill window.scrollTo and scrollIntoView
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

// Ensure clean localStorage for each test run
beforeEach(() => {
  localStorage.clear();
});
