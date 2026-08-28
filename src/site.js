// Site-mode configuration.
//
// The same codebase is deployed to TWO Vercel projects (ai-influencer and
// fan-flow) with a VITE_SITE_MODE env var that selects which mode runs:
//
//   VITE_SITE_MODE=studio    → https://ai-influencer-roan.vercel.app
//   VITE_SITE_MODE=fanflow   → https://fan-flow-five.vercel.app
//
// The Nav cross-links between the two, and the landing page / routing change
// per mode. In local dev the default is 'studio'; set VITE_SITE_MODE=fanflow
// npm run dev to test the FanFlow mode.

const SITE = import.meta.env.VITE_SITE_MODE || 'studio'

export const SITE_MODE = SITE === 'fanflow' ? 'fanflow' : 'studio'
export const IS_STUDIO = SITE_MODE === 'studio'
export const IS_FANFLOW = SITE_MODE === 'fanflow'

export const OTHER_SITE = IS_STUDIO
  ? { label: 'FanFlow', url: 'https://fan-flow-five.vercel.app' }
  : { label: 'Influencer Studio', url: 'https://ai-influencer-roan.vercel.app' }