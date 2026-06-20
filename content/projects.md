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
    date: May 2026
    tagline: "Most AI newsletters are one scheduled blast written for an average reader. dailybriefmail builds one per person: you compose from 22 modules, and each morning a cron job turns your picks into live web-search instructions for Claude, which searches, returns structured JSON, and ships the brief through Resend."
    stack: ["Next.js", "Supabase", "Claude API", "Resend", "Vercel Cron"]
    metrics:
      - "22 modules to compose from"
      - "A fresh brief per reader, every morning"
      - "Live at dailybriefmail.com"
    links:
      - { label: "Live", href: "https://dailybriefmail.com" }
      - { label: "GitHub (agentmail)", href: "https://github.com/nate-bowers/agentmail" }
  - name: SurfScore
    date: Dec 2025
    tagline: "Surf forecasts are noisy, and the NOAA buoys meant to ground them report on their own irregular, gappy intervals while the Open-Meteo forecast feed runs on a regular grid. The real work is reconciling those mismatched timelines into one clean, comparable signal you can actually score a break on."
    stack: ["Python", "Open-Meteo", "NOAA NDBC", "PostgreSQL", "Streamlit"]
    metrics:
      - "Scores 3 NorCal breaks, 0–100"
      - "Score blends wave energy, wind, and swell angle"
      - "Best 2-hour window each day"
      - "Runs daily; tracks error (MAE + bias) vs. buoy"
    links:
      - { label: "GitHub", href: "https://github.com/nate-bowers/SurfScore-project" }
---
