import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        content: 'src/content.ts',
        background: 'src/background.ts',
        popup: 'popup.html',
      },
      output: {
        entryFileNames: '[name].js',
      }
    }
  }
})