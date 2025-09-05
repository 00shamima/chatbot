import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: "/chatbot/", // This is the crucial line you need to add.
  plugins: [react()],
})