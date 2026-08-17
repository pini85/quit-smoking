import type { MetadataRoute } from 'next';

/**
 * Web app manifest. Next emits this at `/manifest.webmanifest` and links it
 * from every page's `<head>`.
 *
 * `background_color` is the dark canvas rather than the light one: the splash
 * screen shows for a blink before the app paints, and starting dark then
 * settling light reads better than the reverse flash. `theme_color` is the
 * brand teal that the system chrome tints itself with.
 */
// `output: 'export'` refuses to prerender a route handler unless it says so
// explicitly; this one has no request-time inputs at all.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Unsmoke',
    short_name: 'Unsmoke',
    description: 'Private, local-first quit-smoking companion',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#101614',
    theme_color: '#0F766E',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
