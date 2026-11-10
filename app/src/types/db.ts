// Row types for the tables the app reads. Mirrors supabase/migrations.
// Regenerate with `npx supabase gen types typescript` once a project is linked.

export type Season = 'kharif' | 'rabi' | 'zaid' | 'perennial';
export type LandUnit = 'acre' | 'hectare' | 'bigha' | 'guntha' | 'kanal';
export type Irrigation = 'rainfed' | 'canal' | 'borewell' | 'well' | 'drip' | 'sprinkler' | 'pond';
export type FarmerType = 'marginal' | 'small' | 'semi_medium' | 'medium' | 'large';
export type Risk = 'low' | 'medium' | 'high';
export type AccountType = 'farmer' | 'buyer' | 'seller';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  language_code: string;
  state_code: string | null;
  district: string | null;
  village: string | null;
  farmer_type: FarmerType | null;
  land_unit: LandUnit;
  voice_autoplay: boolean;
  onboarded: boolean;
  account_type: AccountType;
}

export interface Field {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  boundary_coords: LatLng[] | null;
  area_sq_m: number | null;
  state_code: string | null;
  district: string | null;
  village: string | null;
  irrigation: Irrigation;
  previous_crop_slug: string | null;
  created_at: string;
}

export interface SoilProfile {
  id: string;
  field_id: string;
  source: 'soilgrids' | 'regional' | 'soil_health_card' | 'manual' | 'lab';
  n_kg_ha: number | null;
  p_kg_ha: number | null;
  k_kg_ha: number | null;
  ph: number | null;
  organic_carbon_pct: number | null;
  texture: string | null;
  created_at: string;
}

export interface DailyForecast {
  date: string;
  weather_code: number;
  temp_max: number;
  temp_min: number;
  rain_mm: number;
  rain_probability: number | null;
  wind_max_kmh: number;
}

export interface MonthlyClimate {
  month: number;
  temp_mean: number;
  rain_mm: number;
  humidity: number | null;
}

export interface WeatherSnapshot {
  current: { temperature: number; humidity: number; precipitation: number; weather_code: number; wind_kmh: number };
  daily: DailyForecast[];
  climate: { monthly: MonthlyClimate[]; elevation_m: number | null };
  fetched_at: string;
}

export interface SeasonClimate {
  temp_mean: number;
  rain_mm: number;
  humidity: number;
}

export interface FieldAnalysis {
  soil: SoilProfile | null;
  weather: WeatherSnapshot;
  season: Season;
  season_climate: SeasonClimate;
}

export interface Crop {
  id: string;
  slug: string;
  seasons: Season[];
  emoji: string;
  agmarknet_commodity: string | null;
  crop_translations: { language_code: string; name: string }[];
}

export interface Economics {
  area_ha: number;
  expected_yield_q: number;
  price_inr_q: number;
  price_source: 'mandi' | 'msp' | 'estimate';
  gross_income_inr: number;
  cost_inr: number;
  net_profit_inr: number;
}

export interface RecommendedCrop {
  crop_id: string;
  slug: string;
  emoji: string;
  score: number;
  risk: Risk;
  water_requirement: 'low' | 'medium' | 'high';
  duration_days: [number, number];
  economics: Economics;
  local_name: string;
  why: string;
  risks: string;
  sowing_window: string;
  key_tips: string[];
}

export interface Recommendation {
  id: string;
  field_id: string;
  season: Season;
  year: number;
  results: RecommendedCrop[];
  summary: string | null;
  created_at: string;
}

type NutrientStatus = 'low' | 'medium' | 'high' | 'unknown';

export interface FertilizerPlan {
  area_ha: number;
  soil_status: { n: NutrientStatus; p: NutrientStatus; k: NutrientStatus };
  nutrients_kg_ha: { n: number; p2o5: number; k2o: number };
  products: { slug: string; name: string; kg_per_ha: number; kg_total: number; bags_50kg: number; cost_inr: number }[];
  schedule: { stage: string; day_offset: number; items: { slug: string; kg_total: number }[] }[];
  total_cost_inr: number;
}

export interface Guidance {
  crop_local_name: string;
  overview: string;
  land_preparation: string;
  seed: { varieties: string[]; seed_rate: string; spacing: string; seed_treatment: string };
  irrigation: string;
  fertilizer_tips: string;
  organic_options: string[];
  pest_watch: { name: string; signs: string; action: string }[];
  harvest: string;
}

export interface CropPlan {
  id: string;
  field_id: string;
  crop_id: string;
  season: Season;
  sowing_date: string;
  expected_harvest_date: string | null;
  status: 'planned' | 'active' | 'harvested' | 'abandoned';
  fertilizer_plan: FertilizerPlan;
  guidance: Guidance;
  created_at: string;
  crops?: { slug: string; emoji: string } | null;
}

export interface PlanTask {
  id: string;
  plan_id: string;
  stage: string;
  title: string;
  description: string | null;
  due_date: string;
  status: 'pending' | 'done' | 'skipped';
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_path: string | null;
  created_at: string;
}

export interface Diagnosis {
  is_plant_image: boolean;
  crop_name: string;
  is_healthy: boolean;
  problem_name: string;
  problem_type: string;
  confidence: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  symptoms_seen: string[];
  cause: string;
  organic_treatment: string[];
  chemical_treatment: string[];
  prevention: string[];
  consult_expert: boolean;
  retake_photo_tip: string;
}

export interface DiseaseReport {
  id: string;
  image_path: string;
  crop_name: string | null;
  disease_name: string | null;
  is_healthy: boolean | null;
  confidence: number | null;
  severity: string | null;
  result: Diagnosis;
  created_at: string;
}

export interface Alert {
  id: string;
  field_id: string | null;
  type: 'heavy_rain' | 'rain' | 'heat' | 'cold' | 'frost' | 'wind' | 'task' | 'price';
  severity: 'info' | 'warning' | 'severe';
  data: Record<string, string | number>;
  valid_on: string;
  is_read: boolean;
}

export interface MarketPrice {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
}

export interface Scheme {
  id: string;
  slug: string;
  official_url: string;
  sort_order: number;
  scheme_translations: {
    language_code: string;
    title: string;
    summary: string;
    benefits: string | null;
    eligibility: string | null;
    how_to_apply: string | null;
  }[];
}

export interface State {
  code: string;
  name: string;
}

// Marketplace ------------------------------------------------------------------
export interface CropValuation {
  id: string;
  field_id: string | null;
  crop_slug: string | null;
  area_sq_m: number;
  land_type: string | null;
  growth_stage: string | null;
  health: 'good' | 'fair' | 'poor' | 'unknown' | null;
  expected_yield_q: number | null;
  value_low_inr: number | null;
  value_high_inr: number | null;
  price_inr_q: number | null;
  price_source: 'mandi' | 'msp' | 'estimate' | null;
  result: {
    crop_name_local: string;
    crop_emoji: string;
    confidence: number;
    yield_factor: number;
    observations: string[];
    advice: string[];
  };
  created_at: string;
}

export interface ProduceListing {
  id: string;
  user_id: string;
  field_id: string | null;
  valuation_id: string | null;
  crop_slug: string;
  crop_name: string;
  variety: string | null;
  quantity_q: number;
  price_inr_q: number;
  negotiable: boolean;
  quality_note: string | null;
  available_from: string;
  description: string | null;
  photo_urls: string[];
  state_code: string | null;
  district: string | null;
  village: string | null;
  lat: number | null;
  lng: number | null;
  contact_name: string;
  contact_phone: string;
  whatsapp: boolean;
  status: 'active' | 'sold' | 'closed';
  created_at: string;
}

export interface ListingEnquiry {
  id: string;
  listing_id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_phone: string;
  offered_price_inr_q: number | null;
  quantity_q: number | null;
  message: string | null;
  status: 'new' | 'seen' | 'accepted' | 'declined';
  created_at: string;
  produce_listings?: { crop_name: string; user_id: string } | null;
}

export type ProductCategory = 'seed' | 'fertilizer' | 'biofertilizer' | 'pesticide' | 'tool';

export interface InputProduct {
  id: string;
  seller_id: string | null;
  seller_name: string;
  seller_phone: string | null;
  category: ProductCategory;
  crop_slug: string | null;
  name: string;
  variety: string | null;
  pack_size: string;
  price_inr: number;
  mrp_inr: number | null;
  stock: number;
  certified: boolean;
  description: string | null;
  image_url: string | null;
  is_sample: boolean;
  is_active: boolean;
}

export type OrderStatus = 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface InputOrder {
  id: string;
  buyer_id: string;
  product_id: string;
  seller_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_inr: number;
  total_inr: number;
  delivery_name: string;
  delivery_phone: string;
  delivery_address: string;
  payment_method: 'cod';
  status: OrderStatus;
  created_at: string;
}
