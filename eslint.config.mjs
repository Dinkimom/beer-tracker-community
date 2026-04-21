import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import typescriptSortKeys from 'eslint-plugin-typescript-sort-keys';
import perfectionist from 'eslint-plugin-perfectionist';
import unusedImports from 'eslint-plugin-unused-imports';
import sonarjs from 'eslint-plugin-sonarjs';

/**
 * Политика по уровням (см. также блок `sonarjs/pragmatic-overrides` ниже).
 *
 * Уже `error` в основном блоке: unused-imports, no-eval, eqeqeq, react/jsx-no-target-blank,
 * react-hooks (кроме переопределений ниже), часть no-restricted-syntax, semi, и т.д.
 *
 * Снимок предупреждений (pnpm lint, ~256 warn) по правилам — ориентир для «что поднимать в error»:
 *
 * | Правило | ~кол-во | Рекомендация |
 * |---------|---------|--------------|
 * | sonarjs/no-nested-conditional | ~145 | Оставить warn или off в UI — иначе массовый рефакторинг. |
 * | sonarjs/no-nested-functions | ~35 | То же. |
 * | sonarjs/cognitive-complexity | ~23 | Порог уже 25; error только после снижения шума или отдельный порог в SonarQube. |
 * | react-hooks/exhaustive-deps | ~9 | Кандидат в error поэтапно: много ложных срабатываний — чинить пачками. |
 * | sonarjs/no-nested-template-literals | ~7 | Низкий приоритет / warn. |
 * | sonarjs/todo-tag | ~5 | Можно error в команде без FIXME в проде; иначе warn. |
 * | sonarjs/no-unused-vars | — | `off` (дублирует unused-imports). Неиспользуемые переменные/импорты — см. `unused-imports/*` ниже, severity **error**. |
 * | sonarjs/no-all-duplicated-branches | ~5 | Кандидат в error: мало точек, часто реальные баги. |
 * | react-hooks/set-state-in-effect | ~5 | Сейчас warn (Compiler); error — после согласованного рефакторинга эффектов. |
 * | sonarjs/no-identical-functions | ~3 | Хороший кандидат в error: дублирование логики. |
 * | sonarjs/use-type-alias | ~2 | Кандидат в error при желании единообразия типов. |
 * | sonarjs/no-redundant-jump | ~2 | Кандидат в error (мало срабатываний). |
 * | sonarjs/slow-regex | ~1 | Сильный кандидат в error (безопасность/DoS). |
 * | sonarjs/void-use | ~1 | Кандидат в error. |
 * | sonarjs/no-gratuitous-expressions | ~1 | Кандидат в error (подозрительная логика). |
 * | sonarjs/no-nested-assignment | ~1 | Кандидат в error. |
 * | react-hooks/refs | ~1 | Сейчас warn; error после правки места. |
 * | @next/next/no-img-element | ~1 | Кандидат в error после замены на next/image. |
 * | react/no-unused-prop-types | — | error: неиспользуемые пропы в компонентах с propTypes / проверка имён пропов. |
 *
 * Практичный порядок: (1) поднять в error правила с 1–5 срабатываниями выше;
 * (2) no-all-duplicated-branches, no-identical-functions; (3) react-hooks/exhaustive-deps батчами;
 * (4) Sonar «стилевые» (nested-conditional, nested-functions) не трогать до отдельной инициативы.
 */

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...sonarjs.configs.recommended,
  },
  // SonarJS: рекомендованный набор слишком шумный для React/UI без отдельного SonarQube-пайплайна
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    name: 'sonarjs/pragmatic-overrides',
    rules: {
      'sonarjs/cognitive-complexity': ['warn', 25],
      'sonarjs/pseudo-random': 'off',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/todo-tag': 'warn',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-ignored-return': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/no-unused-collection': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',
      'sonarjs/prefer-while': 'warn',
      // Неиспользуемые переменные: error через unused-imports/no-unused-vars (см. основной блок).
      // Sonar дублирует и ругается на «лишние» поля при omit через _ — оставляем выключенным.
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/no-dead-store': 'warn',
      'sonarjs/redundant-type-aliases': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-gratuitous-expressions': 'warn',
      'sonarjs/use-type-alias': 'warn',
      'sonarjs/no-nested-assignment': 'warn',
      'sonarjs/void-use': 'warn',
      'sonarjs/slow-regex': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
      'typescript-sort-keys': typescriptSortKeys,
      perfectionist: perfectionist,
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Отключаем стандартное правило, используем TypeScript версию
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles this
      
      // TypeScript правила
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off', // Выключаем в пользу unused-imports
      // Неиспользуемые импорты и переменные — только здесь, severity error (Sonar no-unused-vars отключён).
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          args: 'after-used',
        },
      ],
      
      // React правила
      'react/react-in-jsx-scope': 'off', // Не нужно в React 17+
      'react/prop-types': 'off', // Используем TypeScript для типизации
      // Неиспользуемые пропы (ограничения с TypeScript — см. доку react/no-unused-prop-types)
      'react/no-unused-prop-types': 'error',
      // Сортировка пропсов в JSX: сначала пропсы в алфавитном порядке, потом функции/обработчики
      'react/jsx-sort-props': [
        'warn',
        {
          callbacksLast: true, // Функции/обработчики в конце
          shorthandFirst: false, // Не приоритезировать сокращенные пропсы
          ignoreCase: false,
          noSortAlphabetically: false, // Сортировать в алфавитном порядке
          reservedFirst: ['key', 'ref'], // key и ref первыми
        },
      ],
      // Сортировка интерфейсов: сначала свойства в алфавитном порядке, потом методы
      'perfectionist/sort-interfaces': [
        'warn',
        {
          type: 'natural',
          order: 'asc',
          groups: ['property', 'method'],
        },
      ],
      // Сортировка union типов
      '@typescript-eslint/sort-type-constituents': 'warn',
      // Сортировка ключей в интерфейсах и типах
      'typescript-sort-keys/interface': 'off', // Используем perfectionist/sort-interfaces
      'typescript-sort-keys/string-enum': 'warn', // perfectionist не поддерживает enum
      
      // === Безопасность ===
      // Запрет использования dangerouslySetInnerHTML без явного указания
      'react/no-danger': 'warn',
      // Запрет использования eval и подобных опасных функций
      'no-eval': 'error',
      'no-implied-eval': 'error',
      // Запрет использования innerHTML/outerHTML напрямую
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Использование innerHTML/outerHTML небезопасно. Используйте безопасные альтернативы.',
        },
        {
          selector: 'TSImportType',
          message:
            'Запрещены инлайн импорты типов (import("...").Type). Используйте обычный import type в начале файла.',
        },
        {
          selector: 'CallExpression[callee.type="FunctionExpression"]',
          message: 'IIFE (Immediately Invoked Function Expression) запрещены. Вынесите код в именованную функцию или отдельный модуль.',
        },
        {
          selector: 'CallExpression[callee.type="ArrowFunctionExpression"]',
          message: 'IIFE (Immediately Invoked Function Expression) запрещены. Вынесите код в именованную функцию или отдельный модуль.',
        },
      ],
      
      // === Качество кода ===
      // Контроль console.log (разрешаем только console.error и console.warn)
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      // Запрет неиспользуемых выражений
      'no-unused-expressions': 'error',
      // Запрет пустых блоков (кроме catch)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Запрет дублирования ключей в объектах
      'no-dupe-keys': 'error',
      // Запрет дублирования case в switch
      'no-duplicate-case': 'error',
      // Запрет использования == вместо ===
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      // Запрет использования var
      'no-var': 'error',
      // Предпочитать const для переменных, которые не переприсваиваются
      'prefer-const': 'warn',
      // Предпочитать template literals вместо конкатенации строк
      'prefer-template': 'warn',
      
      // === TypeScript специфичные правила ===
      '@typescript-eslint/ban-ts-comment': [
        'warn',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
          'ts-check': false,
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
      '@typescript-eslint/no-empty-interface': 'warn',
      
      // === React специфичные правила ===
      // Запрет использования индексов в качестве key — отключено
      'react/no-array-index-key': 'off',
      // Запрет использования небезопасных target="_blank" без rel="noopener noreferrer"
      'react/jsx-no-target-blank': 'error',
      // Требовать alt для img
      'react/jsx-no-useless-fragment': 'warn',
      // Запрет использования findDOMNode
      'react/no-find-dom-node': 'error',
      // Запрет использования isMounted
      'react/no-is-mounted': 'error',
      // Запрет использования string refs
      'react/no-string-refs': 'error',
      // Запрет использования UNSAFE_ методов жизненного цикла
      'react/no-unsafe': ['warn', { checkAliases: true }],
      // Предупреждение о пропсах, которые могут вызвать проблемы
      'react/no-unescaped-entities': 'warn',
      
      // === Асинхронный код ===
      // Предпочитать async/await вместо .then/.catch
      'prefer-promise-reject-errors': 'error',
      // Запрет промисов без обработки ошибок (требует type information)
      // '@typescript-eslint/no-floating-promises': 'warn',
      // Запрет await в циклах — отключено (допускаем последовательные вызовы по необходимости)
      'no-await-in-loop': 'off',
      // Требовать обработку ошибок в async функциях
      'require-await': 'warn',
      
      // === Комментарии ===
      // Требовать описание для TODO/FIXME комментариев
      'no-warning-comments': [
        'warn',
        {
          terms: ['todo', 'fixme', 'xxx', 'hack'],
          location: 'start',
        },
      ],
      
      // === Импорты ===
      // Сортировка импортов
      'perfectionist/sort-imports': [
        'warn',
        {
          type: 'natural',
          order: 'asc',
          groups: [
            'type',
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'side-effect',
            'style',
          ],
        },
      ],
      // Примечание: import/no-unused-modules не поддерживается в ESLint flat config
      // Для проверки неиспользуемых экспортов рекомендуется использовать:
      // - TypeScript компилятор с флагом --noUnusedLocals
      // - Отдельные инструменты анализа кода (ts-unused-exports, knip)
      
      // === Общие правила качества ===
      // Запрет использования debugger
      'no-debugger': 'error',
      // Запрет использования alert, confirm, prompt
      'no-alert': 'warn',
      // Запрет использования with
      'no-with': 'error',
      // Запрет использования label
      'no-labels': 'error',
      // Запрет использования void оператора (может быть слишком строгим для TypeScript)
      'no-void': 'off',
      // Запрет использования множественных пустых строк
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
      // Требовать точку с запятой
      'semi': ['error', 'always'],
      // Запрет trailing пробелов
      'no-trailing-spaces': 'warn',
      // Запрет пробелов перед запятыми
      'comma-spacing': ['error', { before: false, after: true }],
      // Запрет пробелов внутри скобок объектов
      'object-curly-spacing': ['error', 'always'],
      // Запрет пробелов внутри скобок массивов
      'array-bracket-spacing': ['error', 'never'],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    name: 'react-hooks/pragmatic-overrides',
    rules: {
      // После reactHooksPlugin.configs.recommended — иначе Compiler-правила снова становятся error
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'next-env.d.ts',
      '.next',
      'coverage/**',
      'storybook-static/**',
      '.open-core-export/**',
    ],
  },
];
