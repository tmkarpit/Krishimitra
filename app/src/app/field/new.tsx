import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polygon, Polyline } from '@/components/Map';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, Chip, ChipRow, ErrorView, Input, Row } from '@/components/ui';
import { useCreateField, useCropName, useCrops, useProfile, useStates } from '@/hooks/queries';
import { centroid, distanceM, formatArea, polygonAreaSqM } from '@/lib/geo';
import { currentPosition, placeFor } from '@/lib/location';
import { colors, spacing } from '@/theme';
import type { Irrigation, LatLng } from '@/types/db';

const IRRIGATION: Irrigation[] = ['rainfed', 'canal', 'borewell', 'well', 'drip', 'sprinkler', 'pond'];
const COMMON_CROPS = ['rice', 'wheat', 'maize', 'cotton', 'soybean', 'sugarcane', 'chickpea', 'mustard', 'groundnut', 'bajra', 'pigeonpeas', 'onion'];
const INDIA_CENTER: LatLng = { latitude: 22.5, longitude: 79 };
const ONE_ACRE_SQ_M = 4046.86;

export default function NewField() {
  const { t } = useTranslation();
  const map = useRef<MapView>(null);
  const create = useCreateField();
  const { data: states = [] } = useStates();
  useCrops();
  const cropName = useCropName();
  const unit = useProfile().data?.land_unit ?? 'acre';

  const [me, setMe] = useState<LatLng | null>(null);
  const [points, setPoints] = useState<LatLng[]>([]);
  const [pinOnly, setPinOnly] = useState(false);
  const [walking, setWalking] = useState(false);
  const walkSub = useRef<Location.LocationSubscription | null>(null);

  const [name, setName] = useState('');
  const [irrigation, setIrrigation] = useState<Irrigation>('rainfed');
  const [previousCrop, setPreviousCrop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void currentPosition().then((p) => {
      if (!p) {
        setError(t('field.locationDenied'));
        return;
      }
      setMe(p);
      map.current?.animateToRegion({ ...p, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 600);
    });
    return () => walkSub.current?.remove();
  }, [t]);

  async function toggleWalk() {
    if (walking) {
      walkSub.current?.remove();
      walkSub.current = null;
      setWalking(false);
      return;
    }
    setPinOnly(false);
    setPoints([]);
    setWalking(true);
    walkSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3 },
      (pos) => {
        const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPoints((prev) => (prev.length && distanceM(prev[prev.length - 1], p) < 3 ? prev : [...prev, p]));
      },
    );
  }

  function usePin() {
    if (!me) return;
    setPoints([me]);
    setPinOnly(true);
  }

  const isPolygon = !pinOnly && points.length >= 3;
  const area = isPolygon ? polygonAreaSqM(points) : pinOnly ? ONE_ACRE_SQ_M : 0;

  async function save() {
    if (!isPolygon && !pinOnly) {
      setError(t('field.needPoints'));
      return;
    }
    setError(null);
    const center = isPolygon ? centroid(points) : points[0];
    const place = await placeFor(center, states);
    const field = await create.mutateAsync({
      name: name.trim() || t('field.defaultName'),
      lat: center.latitude,
      lng: center.longitude,
      boundary_coords: isPolygon ? points : null,
      area_sq_m: Math.round(area),
      state_code: place.stateCode,
      district: place.district,
      village: place.village,
      irrigation,
      previous_crop_slug: previousCrop,
    });
    router.replace(`/field/${field.id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <View style={styles.mapWrap}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          mapType="hybrid"
          showsUserLocation
          showsMyLocationButton
          initialRegion={{ ...INDIA_CENTER, latitudeDelta: 20, longitudeDelta: 20 }}
          onPress={(e) => {
            if (walking) return;
            if (pinOnly) {
              setPinOnly(false);
              setPoints([e.nativeEvent.coordinate]);
              return;
            }
            setPoints((prev) => [...prev, e.nativeEvent.coordinate]);
          }}
        >
          {points.map((p, i) => (
            <Marker key={`${i}-${p.latitude}`} coordinate={p} anchor={{ x: 0.5, y: 0.5 }} pinColor={colors.accent}>
              <View style={styles.vertex} />
            </Marker>
          ))}
          {isPolygon ? <Polygon coordinates={points} strokeColor={colors.accent} fillColor="rgba(249,168,37,0.3)" strokeWidth={3} /> : null}
          {!pinOnly && points.length === 2 ? <Polyline coordinates={points} strokeColor={colors.accent} strokeWidth={3} /> : null}
          {pinOnly && points[0] ? <Circle center={points[0]} radius={36} strokeColor={colors.accent} fillColor="rgba(249,168,37,0.3)" /> : null}
        </MapView>
        <View style={styles.banner}>
          <AppText variant="small" style={{ color: colors.white }}>
            {walking ? t('field.walkingHint') : t('field.instructions')}
          </AppText>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="subtitle">
            {area ? `${formatArea(area, unit)} ${t(`units.${unit}`)}` : t('field.points', { count: points.length })}
          </AppText>
          <Row>
            <Chip label={t('field.undo')} icon="arrow-undo" onPress={() => setPoints((p) => p.slice(0, -1))} />
            <Chip label={t('field.clear')} icon="trash" onPress={() => { setPoints([]); setPinOnly(false); }} />
          </Row>
        </Row>
        <Row>
          <Button title={walking ? t('field.stopWalk') : t('field.walkMode')} icon={walking ? 'stop' : 'walk'} variant={walking ? 'danger' : 'secondary'} onPress={toggleWalk} style={{ flex: 1 }} />
          <Button title={t('field.pinMode')} icon="pin" variant="secondary" onPress={usePin} disabled={!me || walking} style={{ flex: 1 }} />
        </Row>

        <Input label={t('field.name')} placeholder={t('field.namePlaceholder')} value={name} onChangeText={setName} />

        <Card style={{ gap: spacing.sm }}>
          <AppText variant="label">{t('field.irrigationLabel')}</AppText>
          <ChipRow>
            {IRRIGATION.map((i) => (
              <Chip key={i} label={t(`irrigation.${i}`)} selected={irrigation === i} onPress={() => setIrrigation(i)} />
            ))}
          </ChipRow>
          <AppText variant="label">{t('field.previousCrop')}</AppText>
          <ChipRow>
            <Chip label={t('field.none')} selected={previousCrop === null} onPress={() => setPreviousCrop(null)} />
            {COMMON_CROPS.map((c) => (
              <Chip key={c} label={cropName(c)} selected={previousCrop === c} onPress={() => setPreviousCrop(c)} />
            ))}
          </ChipRow>
        </Card>

        {error ? <Card tone="danger"><AppText>{error}</AppText></Card> : null}
        {create.error ? <ErrorView error={create.error} /> : null}
        <Button title={t('field.save')} icon="checkmark-circle" loading={create.isPending} onPress={save} disabled={walking} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mapWrap: { height: '48%' },
  banner: { position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing.sm, borderRadius: 8 },
  vertex: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.white },
});
