export const PRODUCTION_PROJECT = 'xftcsuqexzdpgoqeneem';
export const PRODUCTION_CONFIG = Object.freeze({
  environment: 'production',
  url: `https://${PRODUCTION_PROJECT}.supabase.co`,
  key: 'sb_publishable_QqJjE_rJYxl9cfi3fPhQTA_CLwXCCaX',
});

export function resolveEnvironment(env = {}) {
  const branch = env.WORKERS_CI_BRANCH || env.CF_PAGES_BRANCH || env.BRANCH;
  const stagingBranch = branch && branch !== 'main';
  const environment = env.VITE_APP_ENV || (stagingBranch ? 'staging' : 'production');
  if (!['production', 'staging'].includes(environment)) throw new Error('Unknown app environment.');
  if (stagingBranch && environment !== 'staging') throw new Error('Non-main builds must use staging.');
  if (environment === 'production') {
    if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY)
      throw new Error('Production uses its pinned database. Remove staging overrides.');
    return PRODUCTION_CONFIG;
  }
  const url = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const match = /^https:\/\/([a-z]{20})\.supabase\.co$/.exec(url);
  if (!match || [PRODUCTION_PROJECT, 'fhjaxywcholkmavipyjq'].includes(match[1]))
    throw new Error('Staging requires its own Supabase project; production and Learning Studio are blocked.');
  if (!key?.startsWith('sb_publishable_')) throw new Error('Staging requires its own publishable key, never a secret key.');
  return { environment, url, key };
}
