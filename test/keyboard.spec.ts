import { describe, expect, it } from 'vitest';
import { isTypingTarget } from '../lib/geometry.ts';

/**
 * The ruler binds Backspace at the window level, so this guard is what stops a
 * Backspace in the snap-layer picker from deleting a map vertex.
 */
describe('isTypingTarget', () => {
    it('suppresses shortcuts in text inputs', () => {
        expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
        expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    });

    it('suppresses shortcuts in the snap-layer select', () => {
        expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    });

    it('suppresses shortcuts in contenteditable regions', () => {
        expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    });

    it('allows shortcuts on the map canvas and ordinary elements', () => {
        expect(isTypingTarget({ tagName: 'CANVAS' })).toBe(false);
        expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
        expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    });

    it('is case insensitive about tag names', () => {
        expect(isTypingTarget({ tagName: 'input' })).toBe(true);
    });

    it('treats a missing or malformed target as not typing', () => {
        expect(isTypingTarget(null)).toBe(false);
        expect(isTypingTarget(undefined)).toBe(false);
        expect(isTypingTarget('INPUT')).toBe(false);
        expect(isTypingTarget({})).toBe(false);
        expect(isTypingTarget({ tagName: 42 })).toBe(false);
    });

    it('does not treat isContentEditable false as typing', () => {
        expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    });
});
