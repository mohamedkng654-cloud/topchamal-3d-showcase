import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({root:'.',plugins:[react(),tsconfigPaths(),tailwindcss()],build:{outDir:'dist-static',emptyOutDir:true,rollupOptions:{input:'static-app/index.html'}},base:'./'});
