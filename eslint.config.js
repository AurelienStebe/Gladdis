import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: ['main.js', 'lib/', 'types/', 'coverage/'],
    },
    eslint.configs.recommended,
    {
        languageOptions: { parserOptions: { projectService: true } },
    },
    ...tseslint.configs.recommendedTypeChecked,
    {
        files: ['**/*.js'],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
        },
    },
    {
        linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
)
