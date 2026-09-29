# Project guidelines

- Build a personal training profile, not an admin or benchmark dashboard.
- Keep the yearly activity heatmap as the visual hero. Use few charts and restrained borders.
- Match `images/img.png` for information hierarchy and muted palette, using real HTML/CSS/SVG components.
- Default page uses configured online player data. Keep the mock demo at `?demo=1`, clearly labeled and isolated from real data.
- Do not call KovaaK from the browser. Future scheduled jobs write per-player JSON for the static frontend.
- Store business data, not colors or chart dimensions. Training duration is optional; never estimate precise minutes from runs.
- Distinguish missing history, zero activity, and future dates.
- Keep player data configurable in future phases; do not tie components to a specific player's identity.
- Do not add a server, database, centralized player search, arbitrary consistency score, pie chart, or theme engine without a new requirement.
- Validate changes with `npm run build`. Preserve the user's existing IDE files and reference images.
