# Requirements Document

## Introduction

Campus Eats (internal codename: campus-fuel) is a mobile-first meal scheduling and nutrition engine for college students at the University of Washington. It eliminates decision fatigue by cross-referencing a student's academic schedule, physical location, and nutritional goals to surface real-time, route-aware dining recommendations with bioavailability-intelligent meal suggestions. This document derives formal requirements from the approved design document.

## Glossary

- **Auth_System**: The FastAPI authentication service handling registration, login, and JWT issuance
- **Chronos_Engine**: The gap-detection subsystem that identifies eating windows from a student's calendar
- **NutriPath_Optimizer**: The meal scoring and ranking subsystem
- **Transit_Locator**: The route-aware dining location subsystem
- **Notification_Scheduler**: The subsystem that schedules push notifications via Firebase FCM
- **Dashboard**: The React Native "Daily Flow" landing page shown to authenticated users
- **Profile_Page**: The React Native screen where users configure dietary filters, nutrient focus, and preferences
- **Meal_Log_Form**: The React Native screen opened by the `[+]` button for manual meal logging
- **NutrientProfile**: A nutrient-agnostic dict mapping nutrient names to float values
- **EatingWindow**: A gap between calendar events with a start, end, duration, and window type (GOLDEN or MICRO)
- **RankedMeal**: A meal paired with a composite score (0.0–1.0), nutrient gap coverage, and route detour minutes
- **MealLogEntry**: A persisted record of a logged meal including items, portion, nutrients, and bioavailability data
- **Hard_Filter**: A dietary restriction that uses AND logic — every returned meal must satisfy all hard filters
- **Preference_Filter**: A lifestyle diet preference that uses OR logic — returned meals must satisfy at least one
- **USDA**: United States Department of Agriculture — the fallback nutrition database for auto-estimation
- **JWT**: JSON Web Token — the bearer token used for authenticated API requests
- **jti**: JWT ID — a unique claim stored in the sessions table to support token revocation
- **zxcvbn**: Password strength estimation library; score range 0–4
- **Render**: The cloud hosting platform for the FastAPI backend and PostgreSQL database
- **FCM**: Firebase Cloud Messaging — push notification delivery service

---

## Requirements

### Requirement 1: Infrastructure and Deployment

**User Story:** As a developer, I want the backend to deploy automatically from the main branch, so that I can ship updates without manual intervention.

#### Acceptance Criteria

1. WHEN a developer pushes a commit to the `main` branch, THE Render CI/CD pipeline SHALL build and deploy the FastAPI application automatically
2. THE System SHALL store all secrets (`DATABASE_URL`, `JWT_SECRET`, `BCRYPT_ROUNDS`) as Render environment variables, never in source code
3. THE System SHALL use a Render-managed PostgreSQL 15 instance with persistent disk and automatic daily backups
4. THE System SHALL deploy the backend to the Oregon (US West) region
5. ALL database timestamp columns SHALL use `TIMESTAMPTZ` type to ensure timezone-aware storage


---

### Requirement 2: User Registration

**User Story:** As a new student, I want to create a Campus Eats account with a username and password, so that I can access personalized meal recommendations.

#### Acceptance Criteria

1. WHEN a `POST /auth/register` request is received with a valid username, password, and university, THE Auth_System SHALL create a new user record and return an `AuthToken` with HTTP 201
2. WHEN a registration request contains a username shorter than 3 characters, longer than 30 characters, or containing characters outside `[a-zA-Z0-9_]`, THE Auth_System SHALL return HTTP 422 with a descriptive validation error
3. WHEN a registration request contains a password shorter than 10 characters or with a zxcvbn score below 2, THE Auth_System SHALL return HTTP 422 with a descriptive validation error
4. WHEN a registration request contains a `university` value that is not a key in `SUPPORTED_UNIVERSITIES`, THE Auth_System SHALL return HTTP 422
5. WHEN two registration requests for the same username arrive concurrently, THE Auth_System SHALL return HTTP 409 Conflict for the second request and SHALL NOT return HTTP 500
6. THE Auth_System SHALL hash passwords using bcrypt with a minimum of 12 rounds before storage — plaintext passwords SHALL never be persisted
7. THE Auth_System SHALL assign each new user a UUID v4 `user_id` that is globally unique
8. THE Auth_System SHALL NOT include a `confirm_password` field in the `RegisterRequest` payload — password confirmation is validated client-side only
9. THE Auth_System SHALL return an `AuthToken` containing `access_token`, `token_type: "bearer"`, and `expires_in: 86400`

---

### Requirement 3: User Login and Account Lockout

**User Story:** As a returning student, I want to log in securely, so that I can access my personalized schedule and meal data.

#### Acceptance Criteria

1. WHEN a `POST /auth/login` request is received with valid credentials for an unlocked account, THE Auth_System SHALL return HTTP 200 with an `AuthToken`
2. WHEN a login request is received for a username that does not exist, THE Auth_System SHALL run `bcrypt.checkpw` against a dummy hash before returning HTTP 401 — no early exit before the bcrypt comparison
3. WHEN a login request contains an incorrect password, THE Auth_System SHALL return HTTP 401 and increment `failed_login_attempts` for that user
4. WHEN `failed_login_attempts` reaches 5 for a user, THE Auth_System SHALL set `locked_until` to `now() + 15 minutes`
5. WHILE a user account is locked (`locked_until` is in the future), THE Auth_System SHALL return HTTP 401 regardless of whether the submitted password is correct
6. WHEN a login succeeds, THE Auth_System SHALL reset `failed_login_attempts` to 0
7. THE Auth_System SHALL never log or persist the plaintext password at any point during login processing

---

### Requirement 4: JWT Issuance and Middleware

**User Story:** As a developer, I want all protected API routes to require a valid JWT, so that user data is accessible only to authenticated users.

#### Acceptance Criteria

1. WHEN a JWT is issued, THE Auth_System SHALL include `sub` (user_id), `username`, `university`, `iat`, `nbf`, `exp` (iat + 86400), and `jti` claims
2. THE Auth_System SHALL store the `jti` value in an active sessions store upon issuance
3. WHEN a protected route receives a request with a missing `Authorization: Bearer` header, THE Auth_System SHALL return HTTP 401
4. WHEN a protected route receives a request with an expired JWT, THE Auth_System SHALL return HTTP 401 — tokens are not refreshed automatically in v1
5. WHEN a protected route receives a request with an invalid JWT signature, THE Auth_System SHALL return HTTP 401
6. WHEN a protected route receives a JWT whose `jti` is not in the active sessions store, THE Auth_System SHALL return HTTP 401
7. WHEN a valid JWT is presented, THE Auth_System SHALL inject `current_user` into the request context
8. WHEN a user-scoped endpoint is accessed, THE Auth_System SHALL verify that `current_user.user_id` matches the resource's `user_id` — mismatches SHALL return HTTP 403

---

### Requirement 5: Security Controls

**User Story:** As a system operator, I want the API to enforce rate limiting, input sanitization, and SQL injection prevention, so that the platform is protected against common attacks.

#### Acceptance Criteria

1. THE Auth_System SHALL enforce a rate limit of 5 requests per minute per IP on `POST /auth/login`
2. THE Auth_System SHALL enforce a rate limit of 3 requests per minute per IP on `POST /auth/register`
3. THE System SHALL reject all HTTP requests with a 301 redirect to HTTPS — Render TLS enforcement applies to all endpoints
4. THE System SHALL use parameterized queries or SQLAlchemy ORM for all database access — raw string interpolation into SQL is forbidden
5. WHEN free-text fields (`likes`, `dislikes`, `pantry_items`, meal names) are submitted, THE System SHALL sanitize and escape them before storage and rendering
6. THE System SHALL enforce maximum lengths: likes/dislikes items max 50 characters each, max 20 items per list; pantry items max 100 characters each, max 50 items; `nutrients_json` max 64 KB per row
7. THE System SHALL enforce the `UNIQUE(username)` constraint at the database level to prevent race conditions on concurrent registrations
8. THE `JWT_SECRET` SHALL be a minimum 256-bit random value and SHALL never appear in logs or error messages


---

### Requirement 6: Chronos Engine — Eating Window Detection

**User Story:** As a student, I want the app to automatically find free time in my class schedule, so that I know exactly when I can eat without missing class.

#### Acceptance Criteria

1. WHEN `detect_gaps` is called with a list of calendar events, THE Chronos_Engine SHALL return only eating windows with `duration_minutes >= 15`
2. THE Chronos_Engine SHALL classify a window as `GOLDEN` if and only if `duration_minutes >= 45`
3. THE Chronos_Engine SHALL classify a window as `MICRO` if and only if `15 <= duration_minutes < 45`
4. THE Chronos_Engine SHALL ensure no returned eating window overlaps with any calendar event in the input list
5. WHEN `day_start` is provided and the gap before the first event is >= 15 minutes, THE Chronos_Engine SHALL include a morning eating window
6. WHEN `day_end` is provided and the gap after the last event is >= 15 minutes, THE Chronos_Engine SHALL include an evening eating window
7. THE Chronos_Engine SHALL apply `buffer_minutes` (default 10) to both the start and end of each gap before computing duration
8. THE Chronos_Engine SHALL compute `duration_minutes` using floor division (`int(total_seconds // 60)`) to avoid floating-point truncation
9. ALL `EatingWindow` datetime fields (`start`, `end`) SHALL be timezone-aware UTC values
10. WHEN `detect_gaps` is called with an empty event list and valid `day_start`/`day_end`, THE Chronos_Engine SHALL return a single full-day window if the duration qualifies

---

### Requirement 7: NutriPath Optimizer — Meal Scoring

**User Story:** As a student, I want the app to rank available meals by how well they fill my nutritional gaps, so that I can make the best choice for my health goals.

#### Acceptance Criteria

1. WHEN `score_meals` is called, THE NutriPath_Optimizer SHALL return a list of `RankedMeal` objects sorted descending by `score`
2. THE NutriPath_Optimizer SHALL ensure all `RankedMeal.score` values are in the range `[0.0, 1.0]`
3. WHEN the total nutrient deficit is zero (all daily goals met), THE NutriPath_Optimizer SHALL assign a base score of 0.1 to all meals (maintenance mode)
4. THE NutriPath_Optimizer SHALL cap per-nutrient coverage at 1.0 — no meal receives a bonus for exceeding the deficit for any single nutrient
5. THE NutriPath_Optimizer SHALL apply a bioavailability boost (capped at 0.3) for meals whose items enhance absorption of deficit nutrients
6. THE NutriPath_Optimizer SHALL apply a bioavailability penalty (capped at 0.5) for meals whose items inhibit absorption of deficit nutrients
7. THE NutriPath_Optimizer SHALL compute the final composite score as `round(nutrition_score * 0.6 + route_score * 0.4, 4)`
8. IF `apply_dietary_filters` returns an empty list, THEN THE NutriPath_Optimizer SHALL return a `NoMealsAvailable` result rather than calling `score_meals` with an empty list
9. WHEN `academic_intensity` is `finals`, THE NutriPath_Optimizer SHALL apply a +0.10 score boost to MICRO window meals and to meals tagged with `omega3` or `low-sugar`
10. WHEN `dislikeStrictness` is `low`, THE NutriPath_Optimizer SHALL apply a -0.15 score penalty per matching dislike keyword without removing the meal from results
11. WHEN `dislikeStrictness` is `high`, THE NutriPath_Optimizer SHALL exclude meals matching any dislike keyword before scoring

---

### Requirement 8: Dietary Filter Application

**User Story:** As a student with dietary restrictions, I want the app to never recommend meals that violate my allergies or religious requirements, so that I can eat safely.

#### Acceptance Criteria

1. THE NutriPath_Optimizer SHALL ensure every meal returned by `apply_dietary_filters` satisfies ALL tags in `user.hard_filters` (AND logic — no exceptions)
2. WHEN `user.preference_filters` is non-empty, THE NutriPath_Optimizer SHALL ensure every returned meal satisfies AT LEAST ONE preference filter (OR logic)
3. WHEN preference filters produce an empty result set, THE NutriPath_Optimizer SHALL fall back to returning meals that satisfy only the hard filters
4. WHEN both `hard_filters` and `preference_filters` are empty, THE NutriPath_Optimizer SHALL return the full unfiltered meal list
5. THE NutriPath_Optimizer SHALL apply hard filter logic before preference filter logic in all cases

---

### Requirement 9: Nutrient Deficit Calculation

**User Story:** As a student, I want the app to track how much of each nutrient I still need today, so that meal recommendations are based on my actual remaining needs.

#### Acceptance Criteria

1. WHEN `calculate_nutrient_deficit` is called, THE NutriPath_Optimizer SHALL return a `NutrientProfile` where each value equals `max(0, target - consumed)` for each nutrient key
2. THE NutriPath_Optimizer SHALL ensure no deficit value is negative — deficit is floored at 0
3. WHEN a nutrient is present in `targets` but absent from `consumed`, THE NutriPath_Optimizer SHALL treat it as fully unmet (deficit equals the full target value)
4. THE NutriPath_Optimizer SHALL support any nutrient key in `NutrientProfile.values` — the system is nutrient-agnostic and not limited to a fixed set of nutrients

---

### Requirement 10: Transit Locator — Route-Aware Options

**User Story:** As a student, I want the app to only show dining locations I can actually reach and return from within my eating window, so that I don't miss my next class.

#### Acceptance Criteria

1. WHEN `get_route_aware_options` is called, THE Transit_Locator SHALL return only locations where `transit_minutes + wait_time_minutes + min(prep_time_minutes) <= window.duration_minutes`
2. THE Transit_Locator SHALL sort results by `detour_minutes` ascending (path-of-least-resistance first)
3. THE Transit_Locator SHALL apply the user's walking speed multiplier (`slow: 1.4×`, `average: 1.0×`, `power: 0.7×`) when computing transit times
4. WHEN `meal_plan_type` is `commuter_cash`, THE Transit_Locator SHALL exclude swipe-only dining halls from results
5. WHEN `meal_plan_type` is `14_per_week` and the weekly allotment is used, THE Transit_Locator SHALL deprioritize premium cash-only cafes

---

### Requirement 11: Notification Scheduling

**User Story:** As a student, I want timely push notifications about my eating windows, so that I never miss a meal opportunity without realizing it.

#### Acceptance Criteria

1. WHEN `schedule_notifications` is called, THE Notification_Scheduler SHALL schedule a pre-flight briefing notification 30 minutes before the first eating window of the day
2. THE Notification_Scheduler SHALL schedule a window-closing alert 10 minutes before each eating window opens
3. WHEN any nutrient deficit value is greater than 0 at 18:00, THE Notification_Scheduler SHALL schedule a nutrient gap catch-up notification
4. THE Notification_Scheduler SHALL never schedule a notification in the past — all scheduled times SHALL satisfy `scheduled_time >= datetime.now(tz=timezone.utc)`
5. IF a notification would be scheduled in the past, THEN THE Notification_Scheduler SHALL use `max(now(), window.start - 30min)` as the scheduled time
6. THE Notification_Scheduler SHALL not schedule any notifications during active class blocks (DND enforcement)


---

### Requirement 12: Smart Snooze — Missed Meal Recalculation

**User Story:** As a student who skipped a recommended meal, I want the app to automatically update my remaining recommendations, so that I can still meet my nutritional goals for the day.

#### Acceptance Criteria

1. WHEN a student dismisses the contextual auto-log prompt, THE Chronos_Engine SHALL invoke `handle_skipped_meal` and recalculate recommendations for remaining windows
2. WHEN `handle_skipped_meal` is called and remaining windows exist, THE Chronos_Engine SHALL return the next available window with updated meal recommendations that compensate for the missed nutrients
3. WHEN `handle_skipped_meal` is called and no remaining windows exist, THE Chronos_Engine SHALL return an evening catch-up plan based on the current nutrient deficit
4. THE Chronos_Engine SHALL ensure the `next_window` returned by `handle_skipped_meal` has a `start` time strictly in the future

---

### Requirement 13: Daily Flow Dashboard

**User Story:** As a student, I want a single-screen dashboard that shows my next eating window, today's schedule, and my nutrient progress, so that I can make quick decisions without digging through menus.

#### Acceptance Criteria

1. THE Dashboard SHALL display exactly one of three states at any given time: `normal`, `in_class`, or `end_of_day`
2. THE Dashboard SHALL enter `in_class` state if and only if the current time falls within an active class block
3. THE Dashboard SHALL enter `end_of_day` state if and only if all eating windows for the day have ended
4. THE Dashboard SHALL be in `normal` state when at least one future eating window exists and no class block is currently active
5. THE Dashboard SHALL display the Hero Card in `normal` state with a countdown timer and the top-ranked meal recommendation for the next window
6. THE Dashboard SHALL display the Hero Card in `in_class` state with a "Focus Mode" view predicting the best meal for immediately after the current class ends
7. THE Dashboard SHALL display the Hero Card in `end_of_day` state with "Dorm-Chef" mode or dinner suggestions
8. WHEN the Hero Card displays a meal recommendation, THE Dashboard SHALL show the meal name, venue name, walk time in minutes, and per-nutrient match scores
9. ALL `nutrientMatchScores` values and `overallScore` in a meal recommendation SHALL be in the range `[0.0, 1.0]`
10. THE Dashboard SHALL display a horizontally scrollable Day-at-a-Glance Timeline showing class blocks and meal gap blocks for the full day
11. WHEN a timeline block is of type `class`, THE Dashboard SHALL render it as greyed-out and non-tappable, and SHALL NOT display a `nutrientMatchLabel` or `venueHint`
12. WHEN a timeline block is of type `meal_gap`, THE Dashboard SHALL render it as tappable and display a `nutrientMatchLabel` and `venueHint`
13. THE Dashboard SHALL display the Nutrient Pulse section with exactly one progress ring per opted-in nutrient
14. WHEN `showCalories` is `false`, THE Dashboard SHALL not render any calorie values anywhere on the screen
15. THE Dashboard state resolution function SHALL be a pure function — calling it twice with the same inputs SHALL return the same state

---

### Requirement 14: Contextual Auto-Log Flow

**User Story:** As a student, I want the app to ask me if I ate the recommended meal after my window passes, so that my nutrition tracking stays accurate with minimal effort.

#### Acceptance Criteria

1. WHEN an eating window passes, THE Dashboard SHALL automatically surface a contextual prompt asking if the student ate the recommended meal
2. WHEN the student taps "Yes" on the contextual prompt, THE System SHALL silently log the nutrients from the recommended meal into the day's consumed totals without any screen navigation or additional user input
3. WHEN the student taps "No" or dismisses the contextual prompt, THE System SHALL invoke `handle_skipped_meal` and update the evening briefing
4. THE contextual auto-log prompt SHALL be a separate entry point from the `[+]` manual log button — they SHALL never open the same screen

---

### Requirement 15: Profile and Preferences

**User Story:** As a student, I want to configure my dietary restrictions, nutrient goals, and lifestyle preferences, so that all recommendations are personalized to my needs.

#### Acceptance Criteria

1. WHEN `save_preferences` is called, THE Profile_Page SHALL upsert the `user_preferences` row for the given `user_id` and set `updated_at` to the current timestamp
2. THE Profile_Page SHALL enforce that `nutrientFocus` contains between 1 and 3 selections — selecting more than 3 SHALL be blocked with an inline message
3. THE Profile_Page SHALL accept only values from the defined `HardDietaryFilter` set (`nut-free`, `gluten-free`, `halal`, `kosher`) for hard filter fields
4. THE Profile_Page SHALL accept only values from the defined `PreferenceDietaryFilter` set for preference filter fields
5. THE Profile_Page SHALL accept only values from the defined `NutrientFocus` set for nutrient focus fields
6. THE Profile_Page SHALL enforce that `academicIntensity` is one of `chill`, `midterm`, or `finals`
7. THE Profile_Page SHALL enforce that `walkingSpeed` is one of `slow`, `average`, or `power`
8. THE Profile_Page SHALL enforce that `mealPlanType` is one of `unlimited`, `14_per_week`, or `commuter_cash`
9. THE Profile_Page SHALL enforce max lengths: likes/dislikes items max 50 characters, max 20 items per list; pantry items max 100 characters, max 50 items
10. WHEN `walkingSpeed` is set, THE Chronos_Engine SHALL scale `buffer_minutes` by the corresponding multiplier (`slow: 1.4×`, `average: 1.0×`, `power: 0.7×`)
11. WHEN `academicIntensity` is `midterm`, THE NutriPath_Optimizer SHALL boost meals with sustained energy nutrients and deprioritize heavy/slow-digesting meals
12. WHEN the pantry inventory is populated and the dashboard is in `end_of_day` state, THE Dashboard SHALL suggest dorm-based meals using the pantry items
13. THE Profile_Page SHALL default `showCalories` to `false`, `walkingSpeed` to `average`, `academicIntensity` to `chill`, and `mealPlanType` to `unlimited`


---

### Requirement 16: Meal Log Form — Manual Logging

**User Story:** As a student who ate something outside the app's recommendation, I want to manually log any meal from the dining database, so that my nutrition tracking reflects what I actually ate.

#### Acceptance Criteria

1. WHEN the `[+]` button is tapped, THE Meal_Log_Form SHALL open the ManualLogScreen — a full search and select flow separate from the contextual auto-log prompt
2. THE Meal_Log_Form SHALL provide a Smart-Box multi-select interface where students can add multiple food items as chips, building a composite meal
3. THE Meal_Log_Form SHALL display up to 3 "The Usual" shortcut buttons showing the student's most frequently logged meals — tapping one SHALL pre-fill the entire form
4. WHEN a nutrient field is left null, THE Meal_Log_Form SHALL auto-estimate the value using USDA data with the following priority: (1) UW Dining API match → accuracy 0.95, (2) USDA database match → accuracy 0.80, (3) generic category average → accuracy 0.60
5. THE Meal_Log_Form SHALL display estimated nutrient values in grey/italics to visually distinguish them from user-entered values
6. THE Meal_Log_Form SHALL provide a 3-option portion toggle: `0.5×` (Small/Side), `1.0×` (Standard/Entrée, default), `1.5×` (Large/Hungry)
7. WHEN a food item has `is_countable: true`, THE Meal_Log_Form SHALL display a numeric stepper instead of the portion toggle
8. THE Meal_Log_Form SHALL apply the portion multiplier to all nutrient values (estimated and user-entered) before saving
9. THE Meal_Log_Form SHALL enforce that exactly one of `portionSize` or `portionCount` is set per log entry — not both, not neither
10. THE Meal_Log_Form SHALL auto-detect bioavailability inhibitors and enhancers from the logged food items using USDA composition data — the form SHALL NOT expose inhibitor or enhancer input fields to the user
11. THE Meal_Log_Form SHALL display an optional 3-point meal mood emoji scale (😴 Low / 😐 Neutral / ⚡️ High) after logging — the field is nullable
12. WHEN `log_meal` is called, THE Meal_Log_Form SHALL require at least one item in `entry.items`

---

### Requirement 17: Bioavailability Calculation

**User Story:** As a student, I want the app to account for how well my body actually absorbs nutrients from each meal, so that my nutritional tracking is more accurate than simple intake totals.

#### Acceptance Criteria

1. WHEN a meal is logged, THE System SHALL compute `effective_amount` for each tracked nutrient using the appropriate absorption model from `ABSORPTION_MODELS`
2. THE System SHALL ensure `effective_amount <= raw_amount` for every `NutrientLogEntry` — absorption can only reduce intake, never increase it beyond what was consumed
3. THE System SHALL ensure `effective_amount >= 0` for every `NutrientLogEntry`
4. WHEN a nutrient has no registered absorption model, THE System SHALL use the raw amount unchanged as the effective amount
5. THE Dashboard Nutrient Pulse SHALL display `effective_amount` values, not `raw_amount` values
6. THE System SHALL store both `raw_amount` and `effective_amount` in each `NutrientLogEntry` for auditability
7. THE System SHALL auto-detect inhibitors (calcium > 150 mg, caffeine > 100 mg) and enhancers (Vitamin C > 25 mg) from logged food items using USDA average composition data

---

### Requirement 18: Meal Log Accuracy and Deduplication

**User Story:** As a student, I want the app to prevent accidental duplicate logs and clearly communicate how confident it is in estimated nutrient values, so that my data stays clean and trustworthy.

#### Acceptance Criteria

1. THE System SHALL compute `overallAccuracyScore` as the weighted average of all `NutrientLogEntry.accuracyScore` values in a log entry
2. ALL `accuracyScore` values SHALL be in the range `[0.0, 1.0]`
3. THE System SHALL prevent duplicate meal logs: if the same `user_id`, `items` (by MD5 hash), and calendar date are submitted within a 60-second window, THE System SHALL return the existing log entry rather than creating a duplicate
4. THE System SHALL enforce the deduplication constraint at the database level via a partial unique index on `(user_id, logged_at::date, md5(items::text))`
5. WHEN `estimate_nutrients` is called, THE System SHALL return one `NutrientLogEntry` per user-tracked nutrient with `isEstimated = true` and `rawAmount = usda_average * portion`

---

### Requirement 19: University Scope (v1)

**User Story:** As a product owner, I want v1 to be scoped exclusively to the University of Washington, so that we can validate the product before expanding to other universities.

#### Acceptance Criteria

1. THE Auth_System SHALL only accept `university` values that are keys in `SUPPORTED_UNIVERSITIES` — in v1 this is `{"uw_seattle": "University of Washington"}`
2. THE Auth_System SHALL store the university ID (e.g. `"uw_seattle"`) on the user record, not the display name
3. THE System SHALL seed the university dropdown on the registration form with only the supported universities from `SUPPORTED_UNIVERSITIES`
4. WHERE multi-university support is added in a future release, THE Auth_System SHALL extend `SUPPORTED_UNIVERSITIES` without breaking existing `uw_seattle` accounts

