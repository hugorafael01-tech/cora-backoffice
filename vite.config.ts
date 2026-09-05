// `defineConfig` do vitest/config, e nao do vite: e o que conhece a chave
// `test`. O do vite rejeita ela na tipagem.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Sem interceptacao: o reporter padrao do vitest engole console.log de
    // teste que passa, e o golden do gemeo PRECISA imprimir o hash dele em
    // toda rodada — e comparando esse hash com o que o portal imprime que se
    // percebe que alguem regenerou o fixture de um lado so.
    disableConsoleIntercept: true,
  },
})
