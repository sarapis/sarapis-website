#!/usr/bin/env python3
"""Seed the Homepage global (editorial: hero / services / case studies / about).

Round-17 deploy helper for the 'preserve the box DB' path. Idempotent — a POST to
a global replaces its content. Skip this if you ship the local sarapis.db (the
global content is already in it).

Usage:
    python3 deploy/seed-homepage.py <base-url> <admin-email> <admin-password>
    e.g. python3 deploy/seed-homepage.py http://localhost:3009 you@example.org '...'
"""
import json, sys, urllib.request, urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3009").rstrip("/") + "/api"
if len(sys.argv) < 4:
    sys.exit(__doc__)
EMAIL, PASSWORD = sys.argv[2], sys.argv[3]


def req(path, data=None, token=None, method=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"JWT {token}"
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=body, headers=headers,
                               method=method or ("POST" if data is not None else "GET"))
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


HOMEPAGE = {
    "hero": {
        "eyebrow": "Building since 2010",
        "title": "Open Source Good",
        "lead": "Sarapis advances the movement for open source abundance by building practical solutions for people doing good in New York City and beyond.",
        "primaryCtaLabel": "Let’s talk", "primaryCtaHref": "#contact",
        "secondaryCtaLabel": "About Us", "secondaryCtaHref": "/about",
    },
    "services": [
        {"number": "01", "slug": "solution-delivery", "title": "Solution Delivery", "blurb": "We build and deploy open solutions end-to-end — the open source way.", "description": "We scope, design, build, and deploy complete open-source tools — from public data explorers to service directories — working in the open at every step. What we build together belongs to you and to the commons."},
        {"number": "02", "slug": "project-facilitation", "title": "Project Facilitation", "blurb": "We help coalitions of nonprofits, agencies, and communities ship together.", "description": "Civic technology gets built by coalitions — agencies, nonprofits, funders, and community groups. We facilitate that collaboration: translating between technical and civic worlds, building consensus, and keeping shared projects moving toward shared goals."},
        {"number": "03", "slug": "open-source-development", "title": "Open Source Software Development", "blurb": "We steward and extend the FLOSS platforms the public sector depends on.", "description": "We extend, integrate, and maintain free/libre/open-source platforms so organizations can truly own their tools — no vendor lock-in, no rented infrastructure. Long-term stewardship of the digital commons your mission depends on."},
    ],
    "caseStudies": [
        {"type": "Emergency Management", "source": "FACHC", "service": "solution-delivery", "title": "A web app for health-center disaster status reporting", "href": "/posts/a-web-app-for-health-center-disaster-status-reporting"},
        {"type": "Human Services", "source": "Mutual Aid NYC", "service": "open-source-development", "title": "Deploying ORServices — an open service directory", "href": "/posts/deploying-orservices-for-mutual-aid-nyc"},
        {"type": "Open Government", "source": "BetaNYC", "service": "project-facilitation", "title": "Community Board Databases (CBDBs)", "href": "/posts/developing-deploying-community-board-databases-cbdbs-with-betanyc"},
    ],
    "board": [
        {"name": "Devin Balkind", "role": "Principal", "link": "https://devinbalkind.com",
         "bio": "Devin has spent his career applying free/libre/open-source methodologies to civil society's challenges — building software and operational tools for grassroots organizing initiatives, disaster-relief coalitions, nonprofits, and governments. He has presented on disaster response, participatory democracy, and government technology for the American Red Cross, the US Department of Defense, the NYC Mayor's Office, and the United Nations, and his writing on government technology appears in Gotham Gazette."},
        {"name": "Wendy Brawer", "role": "", "link": "http://ecocultural.info",
         "bio": "Wendy is an eco-designer and social sculptor, best known as the founder and director of Green Map System, which has engaged communities in 65 countries in mapping sustainability and social change. Formerly Designer in Residence at the Smithsonian Cooper-Hewitt National Design Museum, she works on inclusive knowledge sharing and climate resiliency across New York City."},
        {"name": "Nicholas J. Davis", "role": "", "link": "",
         "bio": "Nicholas works at the intersection of energy, cleantech, and sustainability, having led the Americas for Agrion, the global business network for energy and sustainability professionals. He began his career at Pacific Gas & Electric and holds a Master's in Resource Economics & Environmental Management from Duke University."},
        {"name": "John Godfrey", "role": "", "link": "",
         "bio": "John is a corporate attorney whose work has centered on intellectual-property matters at media companies, including research on the open-source IP questions facing content-creating businesses. His pro bono practice has included representing clients in the arts."},
        {"name": "Erik Osmond", "role": "", "link": "",
         "bio": "Erik is a software developer who worked full-time at Sarapis through its formative months in 2010 — managing interns, developing projects, and building the organization's financial and regulatory foundations. He is an active contributor to open-source communities."},
        {"name": "Kate Nicholson", "role": "", "link": "",
         "bio": "Kate is a civic-technology organizer with deep roots in New York's civic tech and social-innovation scenes, formerly Director of Partnerships and Events at BetaNYC. She holds an MFA in Design for Social Innovation from the School of Visual Arts."},
    ],
    "about": {
        "lede": "Since 2010, Sarapis has helped nonprofits, community groups, and public agencies build technology they can actually own — free to run, study, share, and improve.",
        "paragraphs": [
            {"text": "We're a New York-incorporated 501(c)(3) nonprofit. We believe the technology public-interest work depends on shouldn't be rented from vendors or locked inside someone else's cloud — it should belong to the people and organizations it serves. So we work in the open with free/libre/open-source tools, and everything we make goes back to the commons."},
            {"text": "In practice that's three kinds of work: delivering complete open-source solutions, facilitating the coalitions civic technology takes to build, and stewarding the open-source platforms the public sector relies on. Our projects span open government, human services, emergency management, and the collaborative economy — in New York City and across the global open-source movement."},
        ],
        "facts": [
            {"key": "Founded", "value": "2010 · New York City"},
            {"key": "Structure", "value": "501(c)(3) nonprofit"},
            {"key": "Practice", "value": "Free, libre & open source"},
            {"key": "Focus areas", "value": "Open Gov · Human Services · Emergency · Economy"},
        ],
    },
}

st, res = req("/users/login", {"email": EMAIL, "password": PASSWORD})
if st != 200:
    print("login failed:", st, res); sys.exit(1)
token = res["token"]
st, res = req("/globals/homepage", HOMEPAGE, token=token, method="POST")
print("homepage seed:", st, "services:", len((res or {}).get("services", [])) if isinstance(res, dict) else res)
sys.exit(0 if st < 400 else 1)
