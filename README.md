# Campus Eats

**Version:** 1.0 (MVP)
**Contributors:** Mahika Bagri

Born at the University of Washington to solve the 'starving student' trade-off, `Campus Eats` is a mobile app designed to eliminate the decision fatigue of college dining. It is the first intelligent dining companion built to sync with the chaotic rhythm of student life, weaving together student schedules, tracking dietary nutrition goals, and campus geography. Campus Eats connects your Google Calendar to the campus dining map, finding the gaps in your day, recommending the nearest venue, and suggesting the specific meal that best covers your nutrient deficits. 

### Motivation

College students are busy. Between back-to-back lectures, study sessions, and everything else, eating well is the first thing to slip. This often has more drastic impacts than students realize at first. For me, it was a dramatic nosebleed, a bloodtest, and the diagnosis of anemia. Anemia isn't just a medical term; for a student, it’s the exhaustion that feels like a wall, breathlessness during a walk up the stairs in Odegaard Library, and the sudden realization that your body is running on empty. It’s the moment you realize your GPA is thriving, but your health is failing because the friction of finding a balanced meal felt like one task too many. CampusEats was created to eliminate the "where," the "when," and the "what" off your plate. It’s more than an app; it’s the safety net I wish I’d had.

---

### Table of Contents

<details>
<summary>Expand</summary>
<ul>
  <li><a href="#campus-eats">Campus Eats</a>
    <ul>
      <li><a href="#motivation">Motivation</a></li>
      <li><a href="#roadmap">Roadmap</a></li>
    </ul>
  </li>
    <li><a href="#core-features-mvp">Core Features (MVP)</a></li>
    <li><a href="#demo">Demo</a></li>
    <li><a href="#feedback-form">Feedback Form</a></li>
  </li>
    <li><a href="#bug-reports">Bug Reports</a></li>
  </li>
  <li><a href="#contact">Contact</a>
    <ul>
      <li><a href="#socials">Socials</a></li>
      <li><a href="#acknowledgements">Acknowledgements</a></li>
    </ul>
  </li>
</ul>
</details>

---

### Roadmap

- [x] JWT auth with password strength enforcement
- [x] Manual meal logging with USDA FDC nutrient data
- [x] Nutrient Pulse — real-time daily progress rings
- [x] Google Calendar OAuth integration
- [x] Eating window detection from calendar gaps
- [x] Venue recommendation engine
- [x] Nutrient-aware meal recommendation (Nutri-Bridge)
- [x] Campus menu seeded with dietary tags
- [x] Rate limiting on all endpoints
- [x] Admin menu management
- [ ] Push notifications for meal windows
- [x] Venue schedule-based open/closed status (real HFS hours)
- [ ] Meal history and weekly trends
- [ ] Friends / social logging
- [ ] EAS production build + App Store submission
---

### Core Features (MVP)

- **Dashboard** — hero card showing your next recommended meal, countdown to your eating window, and one-tap directions.
- **Day Timeline** — horizontal scroll of your class blocks and meal gaps for the day.
- **Nutrient Pulse** — animated rings tracking your daily progress on iron, protein, vitamin D, calcium, B12, and fiber.
- **Meal Logging** — USDA FDC-powered food search with quick portion sizing.
- **Venue Menu** — browse any campus dining location's current menu filtered by meal period.
- **Profile & Preferences** — set dietary restrictions, nutrient focus, walking speed, and academic intensity.
- **Google Calendar Sync** — one-time OAuth connect, then automatic gap detection every session.

### Demo

* [Android Deployment](https://expo.dev/accounts/mbd_123_abc/projects/campus-fuel/builds/0fa8f86f-8a5b-4d01-9607-8b698267fca3)
* [Youtube Demo](https://youtu.be/v-UeyXuKfDI)

### Feedback Form

* [UI/UX Feedback Form](https://forms.gle/q3XGMWAPSceWJqf8A)

---

### Contributing

1. Fork the repo and create a feature branch: `git checkout -b feature/your-feature`
2. Follow existing code style — FastAPI for backend, functional React components for mobile
3. Keep backend endpoints rate-limited and JWT-protected
4. Run `python3 seed_menu.py` and `python3 backfill_nutrients.py` after any menu changes
5. Open a pull request with a clear description of what changed and why

---

### Bug Reports

Please open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Device / OS / Expo SDK version (for mobile bugs)
- Backend logs if relevant (sanitize any personal data)

---

## Contact

### Socials

* [LinkedIn](www.linkedin.com/in/mahika-bagri)
* [Email](mahika13.3@gmail.com)
* [Discord](https://discord.com/users/697914065418321961)

### Acknowledgements

- [USDA FoodData Central](https://fdc.nal.usda.gov/) — nutrient database
- [UW Dining](https://hfs.uw.edu/Eat/Dining-Locations) — menu and venue information
- [Google Calendar API](https://developers.google.com/calendar) — schedule integration
- [Expo](https://expo.dev/) — React Native toolchain
- [Render](https://render.com/) — backend hosting
- [Kiro](https://kiro.dev/) - spec driven AI IDE

---
## Kiro: From Prototype to Production

CampusEats was built entirely using **Kiro**, utilizing a "Spec-Driven" workflow to manage high-complexity integrations like the USDA API and Google OAuth.

* **Spec-Driven Development:** I utilized `.md` specification files to architect the **Chronos** (Gap Detection) and **NutriPath** (Scoring) engines. By defining the logic in markdown first, Kiro generated 90% of the async backend logic with zero architectural drift.
* **Agent Hooks:** I configured custom `file-save` hooks to run `ruff` linting and `pytest` on the FastAPI backend automatically, ensuring that "fire-and-forget" nutrient fetching never broke the main thread.
* **Vibe Coding vs. Structure:** While I used "Vibe Coding" for rapid UI iteration on the **Muted Amethyst** color palette, I pivoted to strict **Steering Files** to enforce `asyncpg` and Type-Safety across the mobile-to-backend bridge.
* **Timeline Checkpointing:** During the complex transition from SQLite to PostgreSQL/Supabase, Kiro's **Checkpointing** feature allowed me to safely explore different connection pool configurations without losing progress.

### Post-Deadline Activity Disclosure
* **March 21:** Emergency hotfix for Android-specific OAuth redirect (switched to `openAuthSessionAsync`) to ensure judges could access the live demo. No new features were added.
* **March 22:** README polish
* **March 23:** Documentation clarity for contact information, Android deployment link update, and Kiro usage.
