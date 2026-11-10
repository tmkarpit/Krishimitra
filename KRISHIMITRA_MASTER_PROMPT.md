# KrishiMitra — Master Build Prompt

> Copy everything below the line into your AI coding assistant. It covers product scope, architecture, database, and server. The UI/design spec is intentionally left as a placeholder (Section 9) to be filled in later.

---

## 0. Role & Goal

You are a senior full-stack engineer building **KrishiMitra**, a production-quality mobile app for Indian farmers, for **Smart India Hackathon 2025 — Problem Statement 25030: "AI-Based Crop Recommendation for Farmers"** (Theme: Agriculture, FoodTech & Rural Development; Team RUBIX, ID 109218).

**Problem:** Farmers struggle to get timely, personalized agricultural advice because of language barriers, limited technical knowledge, limited reach of extension services, and poor rural connectivity.

**Solution:** A multilingual, voice-first mobile app where a farmer selects their language, marks their land on a map, and receives AI-generated, location-specific guidance: which crops to grow, soil fertility management, fertilizer dosage, irrigation, weather alerts, yield and profit estimates, disease diagnosis from leaf photos, and relevant government schemes — by text and voice.

Build in phases (Section 11). Do not skip ahead; each phase must run end-to-end before the next.

---

## 1. Tech Stack (fixed)

| Layer | Choice |
|---|---|
| Mobile | **React Native + Expo (SDK latest stable), TypeScript, Expo Router** |
| State / data | TanStack Query (server state), Zustand (UI/local state) |
| Forms / validation | React Hook Form + Zod (shared Zod schemas with server where possible) |
| i18n | `i18next` + `react-i18next` + `expo-localization` |
| Maps | `react-native-maps` (Google provider) with polygon drawing; `@turf/turf` for area/centroid |
| Location | `expo-location` |
| Camera / images | `expo-image-picker`, `expo-image-manipulator` (compress to ≤1024px, JPEG ~0.7 before upload) |
| Voice input (STT) | `expo-speech-recognition` (on-device, supports `hi-IN`, `mr-IN`, `ta-IN`, etc.); fallback to server STT (Bhashini) |
| Voice output (TTS) | `expo-speech`; fallback to server TTS (Bhashini) for languages without device voices |
| Offline | TanStack Query persistence + `@react-native-async-storage/async-storage`; `expo-sqlite` for cached crop library & last recommendations |
| Notifications | `expo-notifications` (weather alerts, sowing reminders) |
| Backend | **Supabase**: Postgres + PostGIS, Auth (phone OTP), Storage, Row Level Security, Edge Functions (Deno/TypeScript), `pg_cron` |
| ML service | **Python FastAPI** microservice: XGBoost + scikit-learn crop recommendation and yield models (Docker; deploy on Render/Railway/Cloud Run) |
| LLM | Claude (`claude-sonnet-5-5`) via Anthropic API, called **only from Edge Functions** — for guidance generation, chat, and leaf-image disease diagnosis (vision). Keep provider behind an interface so it can be swapped. |
| External APIs | OpenWeather (One Call 3.0), SoilGrids (ISRIC), Bhuvan (ISRO) for LULC/land info, data.gov.in **Agmarknet** mandi prices, Google Maps / Geocoding, Bhashini (STT/TTS/translation) |
| Tooling | ESLint, Prettier, Jest + React Native Testing Library, Supabase CLI (migrations, local dev), EAS Build |

**Security rules:** No API keys in the mobile app except the Supabase anon key and the Google Maps key (restricted to the app's package/SHA). All third-party calls go through Edge Functions. RLS enabled on every table.

---

## 2. Supported Languages

Launch with: **English, Hindi (हिन्दी), Marathi, Punjabi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Odia**. Architecture must make adding a language a matter of adding a JSON file + a row in `languages`.

- First screen of the app = language picker (large tiles, native script, with an audio sample of each language name).
- All static UI strings in `locales/<code>.json`. No hardcoded strings.
- Dynamic content (crop names, scheme descriptions) stored per language in DB translation tables (see schema).
- AI responses generated directly in the user's language (pass `language` to the LLM; instruct it to reply in that language and simple vocabulary for a farmer).
- Numbers/units: show local units too (acre, bigha, guntha, hectare — user selectable; quintal for yield; ₹ for money).
- Every major text block has a 🔊 "listen" button (TTS).

---

## 3. Core Features (MVP)

### 3.1 Onboarding & Auth
- Language selection → phone number → OTP (Supabase phone auth via Twilio/MSG91) → profile (name, village, district, state, farmer type: small/marginal/large, preferred land unit).
- Allow **guest mode** with limited features; prompt sign-up to save fields.

### 3.2 My Farm — Land Marking
- Map screen centred on GPS. Farmer can either:
  - **Draw polygon** by tapping corners, or
  - **Walk the boundary** (record GPS points while walking, simplify the polygon), or
  - **Drop a single pin** (fallback; assume a default buffer radius).
- Compute area (turf), centroid; reverse-geocode village/district/state.
- Save as a `field` (a farmer can have many fields). Optional inputs: irrigation source (rainfed/canal/borewell/drip), last 3 seasons' crops (crop rotation history), soil health card values if available (N, P, K, pH, OC, EC, micronutrients) — allow photo upload of the Soil Health Card.

### 3.3 Field Analysis (automatic after saving a field)
Edge Function `analyze-field` gathers and caches:
- **Soil** — SoilGrids at centroid (pH, SOC, clay/sand/silt, nitrogen, CEC) at 0–30cm; derive soil texture class. If user has Soil Health Card values, those **override** SoilGrids.
- **Weather** — current, 7-day forecast, plus historical climate normals (avg temperature, humidity, seasonal rainfall) for the location.
- **Land / area type** — Bhuvan LULC where available; elevation; agro-climatic zone lookup (from `agro_climatic_zones` table via PostGIS `ST_Contains`).
- Current **season** (Kharif / Rabi / Zaid) derived from date + region.

### 3.4 AI Crop Recommendation (core of PS 25030)
Pipeline:
1. Build feature vector: N, P, K, pH, temperature, humidity, rainfall, soil texture, season, irrigation, agro-climatic zone, previous crop.
2. Call ML service `/predict/crop` → top-N crops with probability (XGBoost trained on the Crop Recommendation dataset + ICAR/data.gov.in district crop data).
3. Re-rank with **rule-based filters** from `crops` table (season fit, water requirement vs irrigation, temperature/rainfall ranges) and **crop rotation** (penalize same family as last season; boost legumes after cereals).
4. Enrich each crop with **market data** (latest Agmarknet modal price at nearest mandis + 30-day trend) and **yield/profit estimate** (`/predict/yield` → expected yield/acre × price − cost of cultivation from `crop_economics`).
5. Send the structured result to the LLM to produce a **farmer-friendly explanation** in the selected language: why this crop, risks, expected profit range, sowing window.
6. Return top 3–5 crops with: suitability score, reason, expected yield, estimated profit, water need, duration, risk level. Store in `recommendations`.

Always show a confidence indicator and a disclaimer ("Consult your nearest KVK for confirmation") — this addresses the **over-reliance on AI** concern from the PPT.

### 3.5 Full Crop Guidance (Cultivation Plan)
When farmer selects a crop for a field → generate a **season plan** (`crop_plans` + `crop_plan_tasks`):
- Land preparation, seed variety (region-appropriate), seed rate, spacing, sowing window
- **Fertilizer calculator**: dose of Urea / DAP / MOP (kg per field area) computed from soil N-P-K vs crop requirement (deterministic formula, not LLM) + organic alternatives
- Irrigation schedule adjusted by forecast rain
- Pest/disease watch-list by growth stage
- Harvest timing and post-harvest storage tips
- Tasks appear on a timeline with reminders (push notifications).

### 3.6 AI Assistant — Chat & Voice
- Chat screen with text input, **mic button (hold to talk)**, and **camera button**.
- Assistant is context-aware: it receives the farmer's profile, selected field, soil/weather snapshot, active crop plan.
- Responses streamed; each reply has 🔊 play button; optional auto-read mode for low-literacy users.
- Guardrails: agriculture-only scope, no pesticide doses beyond label recommendations, encourage KVK/helpline (Kisan Call Centre 1800-180-1551) for serious issues.
- Conversation history stored in `chat_sessions` / `chat_messages`.

### 3.7 Crop Disease Detection (Image)
- Farmer clicks a leaf/plant photo → upload to Storage bucket `disease-images` → Edge Function `diagnose-disease`.
- Phase 1: vision LLM returns structured JSON `{crop, disease, confidence, symptoms, organic_remedy, chemical_remedy, prevention, urgency}`.
- Phase 2 (stretch): on-device/server CNN (e.g., MobileNetV3 trained on PlantVillage + Indian field images) as first pass, LLM for explanation.
- If confidence < threshold → ask for another photo or route to expert.
- Save to `disease_reports`; show history per field.

### 3.8 Weather & Alerts
- 7-day forecast per field, farming-oriented advisories ("Rain expected tomorrow — postpone urea application / spraying").
- `pg_cron` job every 3 hours checks forecasts for all active fields → creates `alerts` (heavy rain, heatwave, frost, high wind, hailstorm) → push notification in user's language.

### 3.9 Market Prices (Mandi)
- Nearest mandis (PostGIS distance), today's modal/min/max price for farmer's crops, 30-day trend chart.
- Daily `pg_cron` sync from Agmarknet into `market_prices`.

### 3.10 Government Schemes
- List of relevant schemes (PM-KISAN, PMFBY crop insurance, Soil Health Card, KCC, PM-KUSUM, state schemes) filtered by state, farmer type, and crop. Translated descriptions, eligibility, documents needed, official link, and a "Read aloud" button.

### 3.11 Offline & Low-Bandwidth Mode
- Cache: last recommendation, active crop plan, crop library, schemes, last weather.
- Queue writes (chat questions, field saves, disease photos) and sync when online.
- "Lite mode" toggle: no map tiles auto-loading, compressed images, text-only answers.

---

## 4. My Suggestions (beyond the PPT) — include as Phase 3+ features

1. **Soil Health Card OCR** — farmer photographs their government SHC; LLM vision extracts N/P/K/pH/OC → far more accurate than SoilGrids.
2. **Bhashini integration** — Government of India's language platform for STT/TTS/translation in 22 languages; strong SIH alignment.
3. **IVR / missed-call fallback (concept)** — for feature-phone farmers; mention in pitch even if not built.
4. **Satellite crop health (NDVI)** via Sentinel-2 (Sentinel Hub / Google Earth Engine) for the marked polygon — show a green/yellow/red health map every 5 days.
5. **Profit simulator** — compare 2–3 crops side by side: cost, yield, price, net profit, water use.
6. **Crop calendar with reminders** — sowing, fertilizer, irrigation, spraying, harvest.
7. **Community Q&A** — farmers in the same district share posts/photos; experts (KVK officers) can be verified and answer.
8. **Expert escalation** — low-confidence AI answer → ticket to a verified agronomist (role `expert`).
9. **Water-aware recommendations** — groundwater stress level of district to discourage water-heavy crops (paddy/sugarcane) in stressed blocks.
10. **Feedback loop** — after harvest, ask actual yield & price → stored in `harvest_feedback` → retrains the yield model (matches PPT's "devices collect field-level data to improve future models").
11. **Admin web dashboard** (later, Next.js) — manage crops, schemes, translations, view analytics.
12. **Accessibility** — big touch targets (≥48dp), icon-first navigation, high-contrast outdoor theme, works on low-end Android (2GB RAM, Android 8+).

---

## 5. System Architecture

```
React Native (Expo) App
   │  supabase-js (Auth, DB via RLS, Storage, Realtime)
   │  functions.invoke(...)
   ▼
Supabase
 ├─ Postgres + PostGIS (+ pg_cron, pg_net)
 ├─ Auth (Phone OTP)
 ├─ Storage (avatars, field-photos, disease-images, soil-cards)
 └─ Edge Functions (Deno/TS) ──► External APIs: OpenWeather, SoilGrids, Bhuvan,
        │                                       Agmarknet, Google Geocoding, Bhashini
        ├──────────────────────► Anthropic API (Claude: chat, guidance, vision)
        └──────────────────────► ML Service (FastAPI + XGBoost) /predict/crop, /predict/yield
```

Principles:
- Edge Functions are the only place secrets live. Validate every input with Zod.
- Cache external API responses in DB tables with `fetched_at` + TTL (weather 1h, soil 90 days, prices 24h) to reduce cost and support offline.
- Every function returns `{ data, error }` with typed error codes.
- Rate limit AI functions per user (e.g., 50 chat msgs/day, 20 diagnoses/day) via `usage_counters` table.

---

## 6. Database Schema (Supabase / Postgres)

Enable extensions: `postgis`, `pg_cron`, `pg_net`, `pgcrypto`, `pg_trgm`.
Use `uuid` primary keys (`gen_random_uuid()`), `created_at`/`updated_at timestamptz default now()` with an `updated_at` trigger on every mutable table. Write everything as Supabase CLI migrations in `supabase/migrations/`.

### 6.1 Enums
```sql
create type farmer_type as enum ('marginal','small','semi_medium','medium','large');
create type land_unit as enum ('acre','hectare','bigha','guntha','kanal');
create type irrigation_type as enum ('rainfed','canal','borewell','well','drip','sprinkler','pond');
create type season as enum ('kharif','rabi','zaid','perennial');
create type plan_status as enum ('planned','active','harvested','abandoned');
create type task_status as enum ('pending','done','skipped');
create type alert_severity as enum ('info','warning','severe');
create type message_role as enum ('user','assistant','system');
create type user_role as enum ('farmer','expert','admin');
```

### 6.2 Reference / master data (read-only for users)
```
languages            (code PK text, name_english, name_native, is_active, tts_supported, stt_supported)
states               (id, code, name, geom MultiPolygon 4326)
districts            (id, state_id FK, name, geom MultiPolygon 4326, groundwater_stage text)
agro_climatic_zones  (id, name, description, geom MultiPolygon 4326)

crops                (id, slug unique, scientific_name, family, category [cereal/pulse/oilseed/vegetable/fruit/cash/spice],
                      seasons season[], duration_days_min, duration_days_max,
                      temp_min, temp_max, rainfall_min_mm, rainfall_max_mm, ph_min, ph_max,
                      water_requirement [low/medium/high], suitable_soil_textures text[],
                      n_req_kg_ha, p_req_kg_ha, k_req_kg_ha, image_url)
crop_translations    (crop_id FK, language_code FK, name, description, PK(crop_id, language_code))
crop_varieties       (id, crop_id FK, name, state_ids int[], duration_days, yield_potential_q_ha, traits jsonb)
crop_stages          (id, crop_id FK, stage_order, name_key, day_start, day_end)
crop_economics       (id, crop_id FK, state_id FK, cost_per_ha_inr, avg_yield_q_ha, year)
diseases             (id, crop_id FK, slug, organic_remedy jsonb, chemical_remedy jsonb, prevention jsonb)
disease_translations (disease_id, language_code, name, symptoms, PK(...))
fertilizers          (id, name, n_pct, p_pct, k_pct, price_per_kg_inr)
schemes              (id, slug, level [central/state], state_id FK nullable, official_url,
                      eligible_farmer_types farmer_type[], crop_ids uuid[], active_from, active_to)
scheme_translations  (scheme_id, language_code, title, summary, eligibility, documents_required, how_to_apply)
mandis               (id, name, state_id, district_id, location geography(Point), agmarknet_code)
```

### 6.3 User data
```
profiles        (id uuid PK = auth.users.id, full_name, phone, role user_role default 'farmer',
                 language_code FK default 'hi', state_id, district_id, village,
                 farmer_type, preferred_land_unit, avatar_url, onboarding_completed bool,
                 notification_token text, voice_autoplay bool default false)

fields          (id, user_id FK profiles, name, boundary geography(Polygon,4326) nullable,
                 centroid geography(Point,4326) not null, area_sq_m numeric,
                 district_id, agro_zone_id, irrigation irrigation_type, elevation_m,
                 is_active bool default true)
                 -- GIST index on boundary and centroid

field_crop_history (id, field_id FK, crop_id FK, season season, year int, yield_q numeric nullable)

soil_profiles   (id, field_id FK, source [soilgrids|soil_health_card|manual|lab],
                 n_kg_ha, p_kg_ha, k_kg_ha, ph, organic_carbon_pct, ec,
                 sand_pct, silt_pct, clay_pct, texture_class, micronutrients jsonb,
                 card_image_path text, raw jsonb, fetched_at)

weather_snapshots (id, field_id FK, current jsonb, daily_forecast jsonb,
                   climate_normals jsonb, fetched_at)   -- TTL 1h

land_insights   (id, field_id FK, lulc_class, bhuvan_raw jsonb, ndvi_latest numeric, fetched_at)

recommendations (id, user_id, field_id, season season, year int,
                 input_features jsonb, model_version text,
                 results jsonb,          -- [{crop_id, score, probability, expected_yield_q, est_profit_inr, risk, reasons[]}]
                 explanation text, language_code, created_at)

crop_plans      (id, user_id, field_id, crop_id, variety_id nullable, recommendation_id nullable,
                 sowing_date date, expected_harvest_date date, status plan_status,
                 fertilizer_plan jsonb, irrigation_plan jsonb, notes text)
crop_plan_tasks (id, plan_id FK, stage_id nullable, title_key, title text, description text,
                 due_date date, status task_status, reminder_sent bool default false)

chat_sessions   (id, user_id, field_id nullable, title, language_code, created_at)
chat_messages   (id, session_id FK, role message_role, content text,
                 audio_path text nullable, image_path text nullable,
                 tokens_in int, tokens_out int, created_at)

disease_reports (id, user_id, field_id nullable, crop_plan_id nullable, image_path,
                 detected_crop text, disease_id nullable, disease_label text,
                 confidence numeric, result jsonb, language_code,
                 expert_reviewed bool default false, expert_notes text)

alerts          (id, user_id, field_id, type [rain|heat|frost|wind|hail|pest|price|task],
                 severity alert_severity, title text, body text, valid_from, valid_to,
                 is_read bool default false, push_sent bool default false)

market_prices   (id, mandi_id FK, crop_id FK, variety text, price_date date,
                 min_price, max_price, modal_price, unique(mandi_id, crop_id, variety, price_date))

harvest_feedback (id, user_id, crop_plan_id, actual_yield_q, sale_price_per_q, satisfaction int 1-5, comments)

saved_schemes   (user_id, scheme_id, PK(user_id, scheme_id))
usage_counters  (user_id, day date, chat_count int, diagnosis_count int, recommendation_count int, PK(user_id, day))
api_cache       (key text PK, value jsonb, expires_at timestamptz)
```

### 6.4 Row Level Security
- Reference tables: `select` for `anon, authenticated`; writes only for `role = 'admin'` (check via `profiles.role`) or service role.
- User tables: `user_id = auth.uid()` for select/insert/update/delete. Child tables (e.g., `soil_profiles`, `crop_plan_tasks`, `chat_messages`) check ownership via `exists (select 1 from fields f where f.id = field_id and f.user_id = auth.uid())`.
- `disease_reports`: owner full access; `expert` role can `select` and `update expert_notes/expert_reviewed`.
- `market_prices`, `alerts` inserts only by service role (cron/functions).
- Storage buckets: `avatars` (public read), `field-photos`, `disease-images`, `soil-cards` (private; path prefix must equal `auth.uid()`).

### 6.5 Functions, triggers, RPCs
- `handle_new_user()` trigger on `auth.users` → insert `profiles` row.
- `set_updated_at()` trigger.
- `fields_before_write()` → compute `centroid`, `area_sq_m`, `district_id`, `agro_zone_id` via PostGIS when `boundary` set.
- RPC `nearest_mandis(lat, lng, limit)`; RPC `field_dashboard(field_id)` returning soil + latest weather + active plan + unread alerts in one call.
- RPC `increment_usage(kind)` used by Edge Functions for rate limiting.
- `pg_cron`: `refresh-weather-alerts` (every 3h), `sync-market-prices` (daily 06:00 IST), `task-reminders` (daily 07:00 IST) — each calls an Edge Function via `pg_net`.

### 6.6 Seed data
`supabase/seed.sql`: languages, states, ~40 major Indian crops with ranges and translations (at least en + hi), fertilizers (Urea 46-0-0, DAP 18-46-0, MOP 0-0-60, SSP 0-16-0, NPK 10-26-26), 10 central schemes, sample mandis.

---

## 7. Server — Supabase Edge Functions (Deno + TypeScript)

Shared code in `supabase/functions/_shared/`: `cors.ts`, `supabaseAdmin.ts`, `auth.ts` (get user from JWT), `llm.ts` (Anthropic client wrapper, model from env), `validate.ts` (Zod), `cache.ts`, `rateLimit.ts`, `i18nPrompt.ts` (language-aware system prompts), `errors.ts`.

| Function | Method / Input | Does |
|---|---|---|
| `analyze-field` | `{ field_id }` | Fetch SoilGrids, OpenWeather (current+forecast+normals), Bhuvan LULC, elevation → upsert `soil_profiles`, `weather_snapshots`, `land_insights`. Idempotent with TTL cache. |
| `recommend-crops` | `{ field_id, season?, language }` | Build features → ML `/predict/crop` → rule filters + rotation → market + `/predict/yield` → LLM explanation → insert `recommendations` → return. |
| `generate-crop-plan` | `{ field_id, crop_id, variety_id?, sowing_date, language }` | Deterministic fertilizer calc + stage tasks from `crop_stages` + LLM for localized tips → insert `crop_plans` + `crop_plan_tasks`. |
| `fertilizer-calc` | `{ field_id, crop_id, area? }` | Pure calculation: requirement − soil supply → Urea/DAP/MOP kg + cost. No LLM. |
| `chat` | `{ session_id?, message, image_path?, field_id?, language }` | Builds context (profile, field, soil, weather, active plan, last 10 messages) → streams LLM response (SSE) → stores messages. |
| `diagnose-disease` | `{ image_path, field_id?, crop_hint?, language }` | Signed URL → vision LLM with strict JSON output → match to `diseases` table → insert `disease_reports`. |
| `read-soil-card` | `{ image_path, field_id }` | Vision LLM OCR of Soil Health Card → `soil_profiles` (source = soil_health_card). |
| `weather` | `{ field_id }` | Cached forecast + farming advisories in user language. |
| `market-prices` | `{ crop_id, lat, lng }` | Nearest mandis + latest prices + 30-day trend. |
| `voice` | `{ mode: 'stt'|'tts', language, audio_base64 | text }` | Bhashini proxy fallback for languages unsupported on device. |
| `cron-weather-alerts` | service only | Scan active fields, create `alerts`, send Expo push. |
| `cron-sync-prices` | service only | Pull Agmarknet (data.gov.in) → upsert `market_prices`. |
| `cron-task-reminders` | service only | Push reminders for tasks due today/tomorrow. |

**LLM prompt rules (put in `_shared/i18nPrompt.ts`):**
- System: "You are KrishiMitra, a friendly agricultural advisor for Indian farmers. Reply ONLY in {language_name}, using simple words a farmer with basic literacy understands. Use local units (acre, quintal, ₹). Keep answers short, step-by-step, practical. If unsure or the issue is serious, recommend contacting the nearest Krishi Vigyan Kendra or Kisan Call Centre 1800-180-1551. Never invent pesticide doses beyond label recommendations. Only answer agriculture-related questions."
- Inject structured context as JSON, not prose. Ask for JSON output with a schema wherever the app needs structured data (recommendations, diagnosis, plan tips).
- Log token usage to `chat_messages`.

**Env / secrets:** `ANTHROPIC_API_KEY`, `LLM_MODEL=claude-sonnet-5-5`, `OPENWEATHER_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `DATA_GOV_IN_API_KEY`, `BHASHINI_USER_ID`, `BHASHINI_API_KEY`, `BHUVAN_TOKEN`, `ML_SERVICE_URL`, `ML_SERVICE_TOKEN`, `EXPO_ACCESS_TOKEN`.

---

## 8. ML Service (Python FastAPI)

```
ml-service/
  app/main.py            # FastAPI: /health, /predict/crop, /predict/yield (bearer token auth)
  app/schemas.py         # Pydantic models
  app/models/            # crop_xgb.joblib, yield_xgb.joblib, label_encoder.joblib
  training/
    train_crop.py        # XGBoost classifier on N,P,K,temperature,humidity,ph,rainfall (+ season, texture one-hot)
    train_yield.py       # XGBoost regressor on district-crop-year yield data (data.gov.in / ICRISAT DLD)
    eda.ipynb            # Pandas, Matplotlib, Seaborn EDA (matches PPT stack)
  data/                  # raw CSVs (gitignored)
  Dockerfile
  requirements.txt
```
- `/predict/crop` → `{ predictions: [{ crop_slug, probability }], model_version }` (top 10).
- `/predict/yield` → `{ crop_slug, yield_q_per_ha, lower, upper }`.
- Report accuracy, F1, confusion matrix; save `model_version` = git SHA + date.
- Stretch: SHAP values per prediction → passed to LLM to explain "why this crop".

---

## 9. UI / UX — PLACEHOLDER

> UI design to be provided later. Until then use a clean placeholder theme: React Native Paper (Material 3), primary green `#2E7D32`, accent amber `#F9A825`, large fonts (base 18), icon-first bottom tabs: **Home · My Farm · Ask AI · Market · Profile**. Keep all styling in a `theme/` folder so it can be replaced wholesale.

Screen list (structure only):
`(onboarding)/language`, `(onboarding)/phone`, `(onboarding)/otp`, `(onboarding)/profile`,
`(tabs)/home` (weather card, active plan tasks, alerts, quick actions),
`(tabs)/farm` (field list) → `field/new` (map drawing) → `field/[id]` (analysis, recommendations, plan, history),
`recommendation/[id]`, `plan/[id]`, `fertilizer-calculator`,
`(tabs)/assistant` (chat + voice + camera) → `diagnose` → `diagnosis/[id]`,
`(tabs)/market`, `schemes`, `scheme/[id]`, `alerts`, `(tabs)/profile`, `settings` (language, units, lite mode, voice autoplay).

---

## 10. Project Structure

```
krishimitra/
  app/                     # Expo Router routes
  src/
    components/  features/<feature>/{api.ts,hooks.ts,components/}
    lib/ (supabase.ts, queryClient.ts, i18n.ts, speech.ts, location.ts, geo.ts)
    store/  theme/  types/ (database.types.ts generated by `supabase gen types`)
  locales/ en.json hi.json mr.json ...
  supabase/
    migrations/  seed.sql  config.toml
    functions/_shared/ + one folder per function
  ml-service/
  .env.example  app.config.ts  eas.json  README.md
```

---

## 11. Build Phases

1. **Foundation** — Expo app, Router, i18n with 3 languages, Supabase project, migrations + RLS + seed, phone auth, profile onboarding, generated DB types.
2. **Farm & Analysis** — map polygon drawing, fields CRUD, `analyze-field` (SoilGrids + OpenWeather), field detail screen.
3. **Recommendation** — ML service (trained model), `recommend-crops`, recommendation screen with TTS, fertilizer calculator.
4. **AI Assistant** — `chat` with streaming, STT mic input, TTS playback, `diagnose-disease` with camera.
5. **Plans, Weather, Market, Schemes** — crop plans + reminders, cron alerts + push, mandi prices, schemes.
6. **Offline & polish** — query persistence, write queue, lite mode, remaining languages, accessibility pass, tests, EAS build.
7. **Stretch** — Soil Health Card OCR, NDVI, profit simulator, community, expert escalation, admin dashboard.

## 12. Definition of Done (each phase)
- TypeScript strict, no `any` in feature code; lint + tests pass.
- All new tables have RLS policies and a migration; types regenerated.
- All new strings exist in every active locale file.
- Works on a low-end Android emulator (API 26, 2GB RAM) and on slow 3G throttling.
- README updated with setup steps and env vars.
