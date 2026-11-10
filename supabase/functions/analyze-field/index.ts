// Gathers soil + weather + climate for a field (cached) and returns them.
import { serve } from "../_shared/http.ts";
import { requireOwnedField, requireUser } from "../_shared/supabase.ts";
import { ensureSoil, ensureWeather } from "../_shared/fieldData.ts";
import { currentSeason, seasonClimate } from "../_shared/agro.ts";

serve<{ field_id?: string; refresh_weather?: boolean }>(async (req, body) => {
  const user = await requireUser(req);
  const field = await requireOwnedField(user.id, body.field_id);

  const [soil, weather] = await Promise.all([
    ensureSoil(field),
    ensureWeather(field, body.refresh_weather === true),
  ]);

  const season = currentSeason();
  return {
    soil,
    weather,
    season,
    season_climate: seasonClimate(weather.climate.monthly, season),
  };
});
