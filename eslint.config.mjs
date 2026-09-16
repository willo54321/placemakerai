import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default [
  { ignores: ['.next/**', '.devdb/**', 'node_modules/**'] },
  ...nextCoreWebVitals,
  {
    rules: {
      // react-hooks v7 (via eslint-config-next 16) added these rules; existing
      // code trips them in ~35 places. Warnings until that cleanup lands.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]
