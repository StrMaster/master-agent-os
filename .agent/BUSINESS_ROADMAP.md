# Master Agent OS — Business Roadmap

## Vizija
Automatizuotas produkto fabrikas: sistema pati randa nišą, sukuria produktą, suranda klientus ir parduoda — minimalus žmogaus įsikišimas.

## Principai
- Manual režimas kol nėra pajamų iš klientų — autonomija vėliau
- Specializuoti įrankiai kiekvienai daliai (Claude = kodas, Tavily = research)
- Human-in-the-loop kritinėse vietose (outreach, pricing approval)
- Kiekvienas klientų produktas yra atskiras repo/deploy — Master OS nematomas

## Workflow
Idėja → Market Research → Competitor Analysis → Product Definition → Cost Calculation → Build → Landing Page → Client Finding → Outreach → Deal → Onboarding → Auto-iteration

---

## Phase 1 — Core Stability (dabartinis fokusas)

- [ ] Multi-file tasks — sistema keičia kelis failus per vieną task'ą
- [ ] Naujo projekto kūrimas — GitHub API: new repo from template + Vercel deploy
- [ ] D5 Cost & Token Control — limitai prieš autonomiją

## Phase 2 — Research Intelligence

- [ ] Research Agent (Tavily API) — web search, structured results
- [ ] Niche Detector — stebi trending topics, Reddit, GitHub issues, siūlo idėjas
- [ ] Competitor Analysis — analizuoja esamus sprendimus rinkoje

## Phase 3 — Business Engine

- [ ] Pricing Engine — API kaštai + infrastruktūra + marža = rekomenduoja kainą
- [ ] Client Finder — ieško potencialių klientų pagal nišą
- [ ] Client Scoring — įvertina: biudžetas, problema, decision maker
- [ ] Outreach System — paruošia žinutes, tu approvinki prieš siunčiant

## Phase 4 — Portfolio & Scale

- [ ] Product Portfolio Tracker — visi produktai, klientai, pajamos, kaštai
- [ ] Auto-iteration — klientas pateikia feedback, sistema sukuria fix task'ą
- [ ] Multi-tenant Support — izoliuoti environments kiekvienam klientui

---

## Technologijų stack

| Funkcija | Technologija |
|---|---|
| Kodas ir patch'ai | Claude Haiku |
| Research | Tavily API |
| Embeddings / semantic search | OpenAI |
| Client finding | Apollo.io API |
| Outreach | Resend (email) |
| Portfolio DB | Supabase |
| Deploy | Vercel |
| Queue / state | Upstash Redis |

---

## Biudžeto kontrolė
- Manual režimas: ~$0.10/dieną
- Su research: ~$0.15/dieną
- Autonomija: TBD — tik po D5 Cost Control įdiegimo
- Tikslas: klientas moka $30-100/mėn, produkto kaštai <$5/mėn

## Saugumo taisyklės
- Outreach reikalauja žmogaus approval
- Autonominis režimas užblokuotas kol nėra D5
- Kiekvienas naujas produktas — atskiras izoliuotas repo
