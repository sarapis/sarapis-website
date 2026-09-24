import { sqliteAdapter } from '@payloadcms/db-sqlite'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'
import { safeEqual } from './utilities/safeEqual'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Projects } from './collections/Projects'
import { Repos } from './collections/Repos'
import { ActivityEvents } from './collections/ActivityEvents'
import { KnowledgeItems } from './collections/KnowledgeItems'
import { Tasks } from './collections/Tasks'
import { ContactSubmissions } from './collections/ContactSubmissions'
import { EmailSignups } from './collections/EmailSignups'
import { Tags } from './collections/Tags'
import { Sites } from './collections/Sites'
import { Events } from './collections/Events'
import { NewsItems } from './collections/NewsItems'
import { CampaignSignups } from './collections/CampaignSignups'
import { CampaignEndorsements } from './collections/CampaignEndorsements'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { Homepage } from './globals/Homepage'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./sarapis.db',
    },
    // Dev auto-syncs the schema (`push`). Production does NOT: push is a no-op in
    // the Next-standalone bundle (no drizzle-kit) and can hang the container on a
    // destructive-diff prompt. Prod schema changes go through committed migrations
    // (see src/migrations + site/DEPLOY.md "Schema changes").
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  collections: [Sites, Pages, Posts, Events, NewsItems, Media, Categories, Tags, Users, Projects, Repos, ActivityEvents, KnowledgeItems, Tasks, ContactSubmissions, EmailSignups, CampaignSignups, CampaignEndorsements],
  // Brand front-ends call this API cross-origin (e.g. wegov.nyc campaign forms).
  // Add brand domains here (+ extend via CORS_ORIGINS, comma-separated).
  //
  // ⚠ EVERY BRAND ORIGIN THAT SUBMITS OR READS FROM THE BROWSER NEEDS AN ENTRY,
  // and a missing one fails INVISIBLY to the app: the browser blocks the request
  // before it is sent, so the front-end only ever sees a generic network error.
  // unnyc.wegov.nyc was missing from 2026-08-04 (when the campaign was extracted
  // out of wegov.nyc/unnyc onto its own subdomain, changing its origin) until
  // 2026-08-06. For those two days EVERY campaign form submission — individual
  // signatures and organization endorsements alike — was silently rejected, and
  // the campaign_endorsements table stayed empty. If a form "does nothing",
  // check the browser console for a CORS error before anything else.
  cors: [
    getServerSideURL(),
    'https://wegov.nyc',
    'https://www.wegov.nyc',
    'https://unnyc.wegov.nyc',
    // The UNNYC campaign. It lives on the un. SUBDOMAIN as of 2026-08-20, so
    // the apex is free for a future opensource.nyc homepage; the apex, www and
    // unnyc.wegov.nyc all 307 there.
    //
    // ⚠ ALL FOUR ARE LISTED, and the three that only redirect are NOT
    // redundant: a redirect does not help a cross-origin POST. The browser
    // preflights the ORIGINAL host, so a page still open on the apex — or a
    // bookmark, or a cached tab — posts with that Origin and is refused if it
    // is missing. unnyc.wegov.nyc above is kept for the same reason.
    'https://un.opensource.nyc',
    'https://opensource.nyc',
    'https://www.opensource.nyc',
    ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
  ].filter(Boolean),
  globals: [Header, Footer, Homepage],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return safeEqual(authHeader || '', `Bearer ${secret}`)
      },
    },
    tasks: [],
  },
})
