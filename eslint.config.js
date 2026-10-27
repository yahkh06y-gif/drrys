// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/*'], // supabase/: server code (Deno), not part of the app
  },
  {
    // The React Compiler rules flag patterns this app uses on purpose: Reanimated shared values
    // (`sv.value = …`), expo-video/expo-audio player properties, refs that mirror the latest state for
    // async callbacks, and syncing state when a prop/route changes. They're correct at runtime; the
    // compiler simply leaves those components un-memoized. Kept visible as warnings, not errors.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // Design system guard: screens and components take their colors from '@/design', not from a hex
    // written on the spot. Warnings for now, so the older screens still pass while they move over.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: ['src/components/SketchPad.tsx'], // the drawing pens are real ink colors, not UI colors
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Use a color token from @/design (color.*) instead of a hex. Missing one? Add it to src/design/tokens.ts.',
        },
        {
          selector: 'Literal[value=/^rgba?\\(/]',
          message: 'Use a color token from @/design (color.overlay.*, color.border.*) instead of rgba().',
        },
      ],
    },
  },
]);
