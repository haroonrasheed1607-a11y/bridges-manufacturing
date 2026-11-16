import { PRODUCTION_CONFIG } from './environment.js';
// Vite validates and embeds this public configuration at build time.
const configuration = typeof __BRIDGES_CONFIG__ === 'undefined' ? PRODUCTION_CONFIG : __BRIDGES_CONFIG__;
const SUPABASE_URL = configuration.url;
const SUPABASE_PUBLISHABLE_KEY = configuration.key;
const APP_ENVIRONMENT = configuration.environment;
export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_ENVIRONMENT };
