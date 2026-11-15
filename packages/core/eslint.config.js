import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    'no-restricted-properties': [
      'error',
      {
        object: 'Math',
        property: 'random',
        message: 'Domain code must be deterministic. Use createRng(seed) from shared/random.',
      },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
  },
});
