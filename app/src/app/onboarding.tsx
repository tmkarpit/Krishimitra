import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatePicker } from '@/components/StatePicker';
import { AppText, Button, Card, Chip, ChipRow, ErrorView, Input, Loading, Screen } from '@/components/ui';
import { useProfile, useStates, useUpdateProfile } from '@/hooks/queries';
import { LAND_UNITS } from '@/lib/geo';
import { currentPosition, placeFor } from '@/lib/location';
import type { AccountType, FarmerType, LandUnit, Profile } from '@/types/db';

const FARMER_TYPES: FarmerType[] = ['marginal', 'small', 'semi_medium', 'medium', 'large'];
const ACCOUNT_TYPES: AccountType[] = ['farmer', 'buyer', 'seller'];

export default function Onboarding() {
  const profile = useProfile();
  if (profile.isLoading) return <Loading />;
  return <OnboardingForm profile={profile.data ?? null} />;
}

/** Also used to edit an existing profile, so it starts from the saved values. */
function OnboardingForm({ profile: p }: { profile: Profile | null }) {
  const { t } = useTranslation();
  const { data: states = [] } = useStates();
  const update = useUpdateProfile();

  const [name, setName] = useState(p?.full_name ?? '');
  const [stateCode, setStateCode] = useState<string | null>(p?.state_code ?? null);
  const [district, setDistrict] = useState(p?.district ?? '');
  const [village, setVillage] = useState(p?.village ?? '');
  const [farmerType, setFarmerType] = useState<FarmerType | null>(p?.farmer_type ?? null);
  const [landUnit, setLandUnit] = useState<LandUnit>(p?.land_unit ?? 'acre');
  const [accountType, setAccountType] = useState<AccountType>(p?.account_type ?? 'farmer');
  const [locating, setLocating] = useState(false);

  async function useMyLocation() {
    setLocating(true);
    const point = await currentPosition();
    if (point) {
      const place = await placeFor(point, states);
      if (place.stateCode) setStateCode(place.stateCode);
      if (place.district) setDistrict(place.district);
      if (place.village) setVillage(place.village);
    }
    setLocating(false);
  }

  async function save() {
    await update.mutateAsync({
      full_name: name.trim() || null,
      state_code: stateCode,
      district: district.trim() || null,
      village: village.trim() || null,
      farmer_type: farmerType,
      land_unit: landUnit,
      account_type: accountType,
      onboarded: true,
    });
    router.replace('/');
  }

  return (
    <Screen>
      <AppText variant="muted">{t('onboarding.subtitle')}</AppText>
      <Card style={{ gap: 10 }}>
        <AppText variant="label">{t('account.iAm')}</AppText>
        <ChipRow>
          {ACCOUNT_TYPES.map((a) => (
            <Chip key={a} label={t(`account.${a}`)} selected={accountType === a} onPress={() => setAccountType(a)} />
          ))}
        </ChipRow>
      </Card>
      <Input label={t('onboarding.name')} value={name} onChangeText={setName} autoCapitalize="words" />
      <Button title={t('onboarding.useLocation')} icon="locate" variant="secondary" loading={locating} onPress={useMyLocation} />
      <StatePicker value={stateCode} onChange={setStateCode} />
      <Input label={t('onboarding.district')} value={district} onChangeText={setDistrict} />
      <Input label={t('onboarding.village')} value={village} onChangeText={setVillage} />

      <Card style={{ gap: 10 }}>
        <AppText variant="label">{t('onboarding.farmerType')}</AppText>
        <ChipRow>
          {FARMER_TYPES.map((f) => (
            <Chip key={f} label={t(`farmerType.${f}`)} selected={farmerType === f} onPress={() => setFarmerType(f)} />
          ))}
        </ChipRow>
        <AppText variant="label">{t('onboarding.landUnit')}</AppText>
        <ChipRow>
          {LAND_UNITS.map((u) => (
            <Chip key={u} label={t(`units.${u}`)} selected={landUnit === u} onPress={() => setLandUnit(u)} />
          ))}
        </ChipRow>
      </Card>

      {update.error ? <ErrorView error={update.error} /> : null}
      <Button title={t('onboarding.finish')} icon="checkmark-circle" loading={update.isPending} onPress={save} />
    </Screen>
  );
}
