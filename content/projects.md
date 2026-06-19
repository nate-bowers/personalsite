---
title: Projects
station: STN 46012
established: est. 2024 · Half Moon Bay
location: 37.36°N 122.88°W
report: "Projects · 2 active stations · all reporting"
surfCam:
  label: "Mavericks cam"
  href: "https://www.surfline.com/surf-report/mavericks/5842041f4e65fad6a7708890"
projects:
  - name: dailybriefmail
    tagline: "Most AI newsletters are one scheduled blast written for an average reader. dailybriefmail builds a brief per person instead: you pick from 20+ modules, and each morning an agent runs live web searches inside a Claude call and emails you a brief written for you."
    stack: ["Next.js", "Claude API", "Resend", "Vercel Cron"]
    metrics:
      - "20+ modules to compose from"
      - "Cron to inbox in under a minute"
      - "Live at dailybriefmail.com"
    links:
      - { label: "Live", href: "https://dailybriefmail.com" }
      - { label: "GitHub", href: "https://github.com/nate-bowers/agentmail" }
  - name: SurfScore
    tagline: "Surf forecasts are noisy, and the NOAA buoys meant to ground them report on their own irregular, gappy intervals while the Open-Meteo forecast feed runs on a regular grid. The real work is reconciling those mismatched timelines into one clean, comparable signal you can actually score a break on."
    stack: ["Python", "Open-Meteo", "NOAA NDBC", "PostgreSQL"]
    metrics:
      - "Computes a 0–100 surf-quality score"
      - "Finds the best 2-hour window daily"
      - "Tracks accuracy vs. real buoy data"
      - "Idempotent pipelines, Streamlit dashboard"
    links:
      - { label: "GitHub", href: "https://github.com/nate-bowers/SurfScore-project" }
---

