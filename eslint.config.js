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
]);
