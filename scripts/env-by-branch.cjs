#!/usr/bin/env node
/**
 * En branche recette uniquement : copie .env.recette vers .env (Supabase local).
 * Sur main ou autre branche : ne fait rien (prod = Vercel, ou .env déjà présent).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

let branch;
try {
  branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
} catch {
  process.exit(0);
}

if (branch !== 'recette') {
  process.exit(0);
}

const envPath = path.join(root, '.env.recette');
if (!fs.existsSync(envPath)) {
  console.warn('[env-by-branch] .env.recette introuvable. Crée-le à partir de .env.example.');
  process.exit(0);
}

fs.copyFileSync(envPath, path.join(root, '.env'));
const content = fs.readFileSync(path.join(root, '.env'), 'utf-8');
const urlMatch = content.match(/NUXT_PUBLIC_SUPABASE_URL=(.+)/m);
const url = urlMatch ? urlMatch[1].trim() : '?';
console.log('[env-by-branch] Branche recette → .env.recette copié vers .env');
console.log('[env-by-branch] NUXT_PUBLIC_SUPABASE_URL =', url);
if (url && !url.includes('127.0.0.1') && !url.includes('localhost')) {
  console.warn('[env-by-branch] Attention : l’URL semble être le cloud, pas le local. Vérifie le contenu de .env.recette.');
}
