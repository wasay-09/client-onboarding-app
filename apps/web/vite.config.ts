import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served at the domain root in dev. To deploy under a reverse-proxy subpath
// (e.g. example.com/onboarding), build with VITE_BASE=/onboarding/ so asset URLs
// are prefixed correctly. Must start and end with a slash.
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
