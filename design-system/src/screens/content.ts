// Representative real content from sarapis.org, baked in so the screens render
// standalone in Claude Design (decoupled from the Payload CMS).

export const NAV = [
  { label: 'Services', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'About', href: '#' },
  { label: 'Let’s Talk', href: '#' },
]

export const WORK_AREAS = [
  { label: 'Open Government', href: '#', blurb: 'Transparency tools and open data that make public institutions accountable.' },
  { label: 'Human Services', href: '#', blurb: 'Open Referral data standards and directories that connect people to help.' },
  { label: 'Emergency Management', href: '#', blurb: 'Disaster-preparedness and mutual-aid systems communities can run themselves.' },
  { label: 'Collaborative Economy', href: '#', blurb: 'Platform cooperatives and shared digital infrastructure owned in common.' },
]

// A small set of branded image placeholders (self-contained data URIs).
const svg = (label: string, bg: string, fg: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${bg}"/><text x="160" y="108" font-family="Georgia,serif" font-size="22" fill="${fg}" text-anchor="middle">${label}</text></svg>`,
  )
export const IMG = {
  databook: svg('Databook', '#2b2622', '#e0a23a'),
  candidates: svg('Daily News', '#14213d', '#ffffff'),
  cbdb: svg('CBDB', '#f3e6df', '#c93241'),
  orservices: svg('ORServices', '#1b2a3a', '#7bdcb5'),
  fachc: svg('FACHC App', '#f0f0f0', '#c93241'),
  mutualaid: svg('MutualAid.NYC', '#c93241', '#ffffff'),
}

export const RECENT_POSTS = [
  { title: "WeGovNYC's Databook Featured in Local News", category: 'Open Government', img: IMG.databook },
  { title: 'Deploying ORServices for Mutual Aid NYC', category: 'Human Services', img: IMG.orservices },
  { title: 'A Web App for Health Center Disaster Status Reporting', category: 'Emergency Management', img: IMG.fachc },
]

export const OPEN_GOV = {
  title: 'The best way for governments to efficiently deliver services to their citizens is by adopting open source tools and agile collaboration.',
  lead: 'We help nonprofits and government agencies leverage open source software and open data to work transparently and democratically.',
  recentWork: [
    { title: "WeGovNYC's Databook Featured in Local News", category: 'Open Government', img: IMG.databook },
    { title: 'Candidate Comparison Tool for the Daily News and Gotham Gazette', category: 'Open Government', img: IMG.candidates },
    { title: 'Developing & Deploying Community Board Databases (CBDBs) with BetaNYC', category: 'Open Government', img: IMG.cbdb },
  ],
  quote:
    '“The Strategy is Delivery” was coined by the UK Government Digital Service. It reminds civil servants that their number one priority must be delivering more and more value to their users. Everyday.',
  perspectives: [
    { title: '2020 School of Data: How to build a database “with not for”', category: 'Perspective', img: IMG.cbdb },
    { title: 'SimCity Showed Us Brilliant Civic Technology Interfaces 30 Years Ago', category: 'Perspective', img: IMG.databook },
    { title: 'What is “Municipalism”?', category: 'Perspective', img: IMG.candidates },
  ],
}

export const BLOG_POSTS = [
  { title: "WeGovNYC's Databook Featured in Local News", category: 'Open Government', img: IMG.databook },
  { title: 'Deploying ORServices for Mutual Aid NYC', category: 'Human Services', img: IMG.orservices },
  { title: 'Candidate Comparison Tool for the Daily News and Gotham Gazette', category: 'Open Government', img: IMG.candidates },
  { title: 'A Web App for Health Center Disaster Status Reporting', category: 'Emergency Management', img: IMG.fachc },
  { title: 'Helping People Help: Our COVID-19 Response with MutualAid.NYC', category: 'Emergency Management', img: IMG.mutualaid },
  { title: 'Developing & Deploying Community Board Databases (CBDBs) with BetaNYC', category: 'Open Government', img: IMG.cbdb },
]

export const POST = {
  category: 'Emergency Management',
  title: 'A Web App for Health Center Disaster Status Reporting',
  date: 'March 13, 2023',
  hero: IMG.fachc,
  body: [
    'The Florida Association of Community Health Centers is responsible for maintaining communication with over 600 federally-funded Community Health Centers throughout Florida during disasters like hurricanes.',
    'Like many organizations doing this type of work, they sent out a long online survey during disasters asking participants for status reports and needs requests. This information was collected into a spreadsheet that took over 15 minutes to fill out.',
    'We built a free, libre & open source web application that lets each health center report its operational status in under a minute, and gives coordinators a live map and dashboard of the whole network.',
  ],
}
