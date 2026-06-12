// Self-hosted fonts (was a Google Fonts CDN link in index.html). Bundled
// via @fontsource so the theme survives offline play, blocked CDNs, and
// avoids the cross-origin request entirely. Weights match prior usage:
// Cinzel 500/700 (display), EB Garamond 400/500/600 + italics (body),
// IBM Plex Mono 400/500 (figures).
import '@fontsource/cinzel/500.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/eb-garamond/400.css'
import '@fontsource/eb-garamond/400-italic.css'
import '@fontsource/eb-garamond/500.css'
import '@fontsource/eb-garamond/500-italic.css'
import '@fontsource/eb-garamond/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import { mount } from 'svelte'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) {
  throw new Error('Missing #app mount node')
}

mount(App, { target })
