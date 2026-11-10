import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { callFunction, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type {
  Alert,
  Crop,
  CropPlan,
  CropValuation,
  DiseaseReport,
  Field,
  FieldAnalysis,
  InputOrder,
  InputProduct,
  ListingEnquiry,
  MarketPrice,
  OrderStatus,
  PlanTask,
  ProduceListing,
  ProductCategory,
  Profile,
  Recommendation,
  Scheme,
  Season,
  SoilProfile,
  State,
} from '@/types/db';

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

export const today = () => new Date().toISOString().slice(0, 10);

// Profile ---------------------------------------------------------------------
export function useProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: !!session,
    queryFn: () => unwrap<Profile>(supabase.from('profiles').select('*').eq('id', session!.user.id).single()),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (patch: Partial<Profile>) =>
      unwrap<Profile>(supabase.from('profiles').update(patch).eq('id', session!.user.id).select().single()),
    onSuccess: (profile) => qc.setQueryData(['profile', session?.user.id], profile),
  });
}

// Reference data --------------------------------------------------------------
export function useStates() {
  return useQuery({
    queryKey: ['states'],
    staleTime: Infinity,
    queryFn: () => unwrap<State[]>(supabase.from('states').select('code, name').order('name')),
  });
}

export function useCrops() {
  return useQuery({
    queryKey: ['crops'],
    staleTime: Infinity,
    queryFn: () =>
      unwrap<Crop[]>(
        supabase.from('crops').select('id, slug, seasons, emoji, agmarknet_commodity, crop_translations(language_code, name)').eq('is_active', true).order('slug'),
      ),
  });
}

/** Crop display name in the current language, falling back to English. */
export function useCropName() {
  const { i18n } = useTranslation();
  const { data: crops } = useCrops();
  return (slug: string | null | undefined) => {
    if (!slug) return '';
    const crop = crops?.find((c) => c.slug === slug);
    const names = crop?.crop_translations ?? [];
    return names.find((n) => n.language_code === i18n.language)?.name ?? names.find((n) => n.language_code === 'en')?.name ?? slug;
  };
}

export function useSchemes() {
  return useQuery({
    queryKey: ['schemes'],
    staleTime: 60 * 60 * 1000,
    queryFn: () =>
      unwrap<Scheme[]>(
        supabase.from('schemes').select('id, slug, official_url, sort_order, scheme_translations(*)').eq('is_active', true).order('sort_order'),
      ),
  });
}

// Fields ----------------------------------------------------------------------
export function useFields() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['fields'],
    enabled: !!session,
    queryFn: () => unwrap<Field[]>(supabase.from('fields').select('*').eq('is_active', true).order('created_at')),
  });
}

export function useField(id: string | undefined) {
  return useQuery({
    queryKey: ['field', id],
    enabled: !!id,
    queryFn: () => unwrap<Field>(supabase.from('fields').select('*').eq('id', id!).single()),
  });
}

export type NewField = Pick<Field, 'name' | 'lat' | 'lng' | 'boundary_coords' | 'area_sq_m' | 'state_code' | 'district' | 'village' | 'irrigation' | 'previous_crop_slug'>;

export function useCreateField() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (field: NewField) =>
      unwrap<Field>(supabase.from('fields').insert({ ...field, user_id: session!.user.id }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(supabase.from('fields').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  });
}

export function useFieldAnalysis(fieldId: string | undefined) {
  return useQuery({
    queryKey: ['analysis', fieldId],
    enabled: !!fieldId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: () => callFunction<FieldAnalysis>('analyze-field', { field_id: fieldId }),
  });
}

export function useLatestSoil(fieldId: string | undefined) {
  return useQuery({
    queryKey: ['soil', fieldId],
    enabled: !!fieldId,
    queryFn: () =>
      unwrap<SoilProfile | null>(
        supabase.from('soil_profiles').select('*').eq('field_id', fieldId!).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ),
  });
}

export function useSaveManualSoil(fieldId: string) {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (values: Pick<SoilProfile, 'n_kg_ha' | 'p_kg_ha' | 'k_kg_ha' | 'ph' | 'organic_carbon_pct' | 'texture'>) =>
      unwrap(supabase.from('soil_profiles').insert({ ...values, field_id: fieldId, user_id: session!.user.id, source: 'manual' })),
    onSuccess: () => invalidateSoil(qc, fieldId),
  });
}

export function useReadSoilCard(fieldId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imagePath: string) => callFunction<SoilProfile>('read-soil-card', { field_id: fieldId, image_path: imagePath }),
    onSuccess: () => invalidateSoil(qc, fieldId),
  });
}

function invalidateSoil(qc: ReturnType<typeof useQueryClient>, fieldId: string) {
  qc.invalidateQueries({ queryKey: ['soil', fieldId] });
  qc.invalidateQueries({ queryKey: ['analysis', fieldId] });
}

// Recommendations & plans -------------------------------------------------------
export function useRecommendations(fieldId: string | undefined) {
  return useQuery({
    queryKey: ['recommendations', fieldId],
    enabled: !!fieldId,
    queryFn: () =>
      unwrap<Recommendation[]>(
        supabase.from('recommendations').select('*').eq('field_id', fieldId!).order('created_at', { ascending: false }).limit(5),
      ),
  });
}

export function useRecommendation(id: string | undefined) {
  return useQuery({
    queryKey: ['recommendation', id],
    enabled: !!id,
    queryFn: () => unwrap<Recommendation>(supabase.from('recommendations').select('*').eq('id', id!).single()),
  });
}

export function useRecommend() {
  const qc = useQueryClient();
  const { i18n } = useTranslation();
  return useMutation({
    mutationFn: (vars: { fieldId: string; season: Season }) =>
      callFunction<Recommendation>('recommend-crops', { field_id: vars.fieldId, season: vars.season, language: i18n.language }),
    onSuccess: (rec) => {
      qc.setQueryData(['recommendation', rec.id], rec);
      qc.invalidateQueries({ queryKey: ['recommendations', rec.field_id] });
    },
  });
}

const PLAN_SELECT = '*, crops(slug, emoji)';

export function usePlans(fieldId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['plans', fieldId ?? 'all'],
    enabled: !!session,
    queryFn: () => {
      let q = supabase.from('crop_plans').select(PLAN_SELECT).in('status', ['planned', 'active']).order('sowing_date', { ascending: false });
      if (fieldId) q = q.eq('field_id', fieldId);
      return unwrap<CropPlan[]>(q);
    },
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: ['plan', id],
    enabled: !!id,
    queryFn: () => unwrap<CropPlan>(supabase.from('crop_plans').select(PLAN_SELECT).eq('id', id!).single()),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  const { i18n } = useTranslation();
  return useMutation({
    mutationFn: (vars: { fieldId: string; cropSlug: string; sowingDate: string; recommendationId?: string; season?: Season }) =>
      callFunction<CropPlan>('crop-plan', {
        field_id: vars.fieldId,
        crop_slug: vars.cropSlug,
        sowing_date: vars.sowingDate,
        recommendation_id: vars.recommendationId,
        season: vars.season,
        language: i18n.language,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdatePlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: CropPlan['status'] }) =>
      unwrap(supabase.from('crop_plans').update({ status: vars.status }).eq('id', vars.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function usePlanTasks(planId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', planId],
    enabled: !!planId,
    queryFn: () => unwrap<PlanTask[]>(supabase.from('crop_plan_tasks').select('*').eq('plan_id', planId!).order('due_date')),
  });
}

/** Pending tasks due within the next few days (including overdue), for active plans. */
export function useUpcomingTasks(days = 3) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['tasks', 'upcoming', days],
    enabled: !!session,
    queryFn: async () => {
      const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const rows = await unwrap<(PlanTask & { crop_plans: { status: string; crops: { slug: string; emoji: string } | null } | null })[]>(
        supabase
          .from('crop_plan_tasks')
          .select('*, crop_plans(status, crops(slug, emoji))')
          .eq('status', 'pending')
          .lte('due_date', until)
          .order('due_date')
          .limit(20),
      );
      return rows.filter((r) => r.crop_plans?.status === 'active');
    },
  });
}

export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: PlanTask['status'] }) =>
      unwrap(supabase.from('crop_plan_tasks').update({ status: vars.status }).eq('id', vars.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// Alerts, diagnosis, market -------------------------------------------------------
export function useAlerts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['alerts'],
    enabled: !!session,
    queryFn: () =>
      unwrap<Alert[]>(supabase.from('alerts').select('*').gte('valid_on', today()).order('valid_on').limit(30)),
  });
}

export function useDiseaseReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['disease-reports'],
    enabled: !!session,
    queryFn: () =>
      unwrap<DiseaseReport[]>(supabase.from('disease_reports').select('*').order('created_at', { ascending: false }).limit(20)),
  });
}

export function useDiagnose() {
  const qc = useQueryClient();
  const { i18n } = useTranslation();
  return useMutation({
    mutationFn: (vars: { imagePath: string; cropHint?: string; fieldId?: string }) =>
      callFunction<DiseaseReport>('diagnose-disease', {
        image_path: vars.imagePath,
        crop_hint: vars.cropHint,
        field_id: vars.fieldId,
        language: i18n.language,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disease-reports'] }),
  });
}

export function useMarketPrices(commodity: string | null, state: string | null) {
  return useQuery({
    queryKey: ['market', commodity, state],
    enabled: !!commodity,
    staleTime: 30 * 60 * 1000,
    queryFn: () =>
      callFunction<{ source: 'live' | 'cache'; configured: boolean; prices: MarketPrice[] }>('market-prices', {
        commodity,
        state,
      }),
  });
}

// Marketplace ------------------------------------------------------------------
export function useValuation(id: string | undefined) {
  return useQuery({
    queryKey: ['valuation', id],
    enabled: !!id,
    queryFn: () => unwrap<CropValuation>(supabase.from('crop_valuations').select('*').eq('id', id!).single()),
  });
}

export function useEstimateValue() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { imagePaths: string[]; fieldId?: string; cropSlug?: string; areaSqM?: number }) =>
      callFunction<CropValuation>('estimate-crop-value', {
        image_paths: vars.imagePaths,
        field_id: vars.fieldId,
        crop_slug: vars.cropSlug,
        area_sq_m: vars.areaSqM,
        language: i18n.language,
      }),
    onSuccess: (v) => qc.setQueryData(['valuation', v.id], v),
  });
}

export function useListings(filter: { cropSlug?: string | null; mine?: boolean }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['listings', filter.cropSlug ?? 'all', filter.mine ? 'mine' : 'all'],
    enabled: !!session,
    queryFn: () => {
      let q = supabase.from('produce_listings').select('*').order('created_at', { ascending: false }).limit(100);
      q = filter.mine ? q.eq('user_id', session!.user.id) : q.eq('status', 'active');
      if (filter.cropSlug) q = q.eq('crop_slug', filter.cropSlug);
      return unwrap<ProduceListing[]>(q);
    },
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['listing', id],
    enabled: !!id,
    queryFn: () => unwrap<ProduceListing>(supabase.from('produce_listings').select('*').eq('id', id!).single()),
  });
}

export type NewListing = Omit<ProduceListing, 'id' | 'user_id' | 'status' | 'created_at'>;

export function useCreateListing() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (listing: NewListing) =>
      unwrap<ProduceListing>(supabase.from('produce_listings').insert({ ...listing, user_id: session!.user.id }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });
}

export function useUpdateListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: ProduceListing['status'] }) =>
      unwrap(supabase.from('produce_listings').update({ status: vars.status }).eq('id', vars.id)),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      qc.invalidateQueries({ queryKey: ['listing', vars.id] });
    },
  });
}

/** Offers on a listing: the seller sees all of them, a buyer only their own (enforced by RLS). */
export function useEnquiries(listingId: string | undefined) {
  return useQuery({
    queryKey: ['enquiries', listingId],
    enabled: !!listingId,
    queryFn: () =>
      unwrap<ListingEnquiry[]>(
        supabase.from('listing_enquiries').select('*').eq('listing_id', listingId!).order('created_at', { ascending: false }),
      ),
  });
}

export function useSendEnquiry() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (e: Pick<ListingEnquiry, 'listing_id' | 'buyer_name' | 'buyer_phone' | 'offered_price_inr_q' | 'quantity_q' | 'message'>) =>
      unwrap(supabase.from('listing_enquiries').insert({ ...e, buyer_id: session!.user.id })),
    onSuccess: (_d, e) => qc.invalidateQueries({ queryKey: ['enquiries', e.listing_id] }),
  });
}

export function useSetEnquiryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; listingId: string; status: ListingEnquiry['status'] }) =>
      unwrap(supabase.from('listing_enquiries').update({ status: vars.status }).eq('id', vars.id)),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['enquiries', vars.listingId] }),
  });
}

export function useProducts(filter: { category: ProductCategory | 'all'; cropSlug?: string | null }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['products', filter.category, filter.cropSlug ?? 'all'],
    enabled: !!session,
    queryFn: () => {
      // Real sellers' products first, then the sample catalogue.
      let q = supabase.from('input_products').select('*').eq('is_active', true).order('is_sample').order('name').limit(100);
      if (filter.category !== 'all') q = q.eq('category', filter.category);
      if (filter.cropSlug) q = q.eq('crop_slug', filter.cropSlug);
      return unwrap<InputProduct[]>(q);
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    queryFn: () => unwrap<InputProduct>(supabase.from('input_products').select('*').eq('id', id!).single()),
  });
}

export type NewProduct = Pick<
  InputProduct,
  'seller_name' | 'seller_phone' | 'category' | 'crop_slug' | 'name' | 'variety' | 'pack_size' | 'price_inr' | 'mrp_inr' | 'stock' | 'certified' | 'description' | 'image_url'
>;

export function useCreateProduct() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: (p: NewProduct) =>
      unwrap<InputProduct>(supabase.from('input_products').insert({ ...p, seller_id: session!.user.id }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    // Price, seller and total are set by a database trigger from the product row.
    mutationFn: (o: Pick<InputOrder, 'product_id' | 'quantity' | 'delivery_name' | 'delivery_phone' | 'delivery_address'>) =>
      unwrap<InputOrder>(
        supabase
          .from('input_orders')
          .insert({ ...o, buyer_id: session!.user.id, product_name: '', unit_price_inr: 0, total_inr: 0 })
          .select()
          .single(),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

export function useOrders(kind: 'placed' | 'received') {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['orders', kind],
    enabled: !!session,
    queryFn: () =>
      unwrap<InputOrder[]>(
        supabase
          .from('input_orders')
          .select('*')
          .eq(kind === 'placed' ? 'buyer_id' : 'seller_id', session!.user.id)
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: OrderStatus }) =>
      unwrap(supabase.from('input_orders').update({ status: vars.status }).eq('id', vars.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
