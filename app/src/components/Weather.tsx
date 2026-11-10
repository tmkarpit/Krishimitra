import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { formatDate } from '@/lib/i18n';
import { colors, radius, spacing } from '@/theme';
import type { DailyForecast, WeatherSnapshot } from '@/types/db';
import { AppText, Card, type IconName, Row } from './ui';

/** WMO weather code -> translation key + icon. */
export function weatherKind(code: number): { key: string; icon: IconName } {
  if (code === 0) return { key: 'clear', icon: 'sunny' };
  if (code <= 2) return { key: 'partly', icon: 'partly-sunny' };
  if (code === 3) return { key: 'cloudy', icon: 'cloudy' };
  if (code <= 48) return { key: 'fog', icon: 'cloudy' };
  if (code <= 57) return { key: 'drizzle', icon: 'rainy-outline' };
  if (code <= 63 || (code >= 80 && code <= 81)) return { key: 'rainy', icon: 'rainy' };
  if (code <= 67 || code === 82) return { key: 'heavyRain', icon: 'rainy' };
  if (code <= 77 || (code >= 85 && code <= 86)) return { key: 'snow', icon: 'snow' };
  return { key: 'thunder', icon: 'thunderstorm' };
}

export function WeatherNow({ weather, title }: { weather: WeatherSnapshot; title?: string }) {
  const { t } = useTranslation();
  const c = weather.current;
  const kind = weatherKind(c.weather_code);
  return (
    <Card tone="info" style={{ gap: spacing.md }}>
      {title ? <AppText variant="small">{title}</AppText> : null}
      <Row style={{ gap: spacing.lg }}>
        <Ionicons name={kind.icon} size={52} color={colors.info} />
        <View style={{ flex: 1 }}>
          <AppText variant="hero">{Math.round(c.temperature)}°C</AppText>
          <AppText variant="muted">{t(`weather.${kind.key}`)}</AppText>
        </View>
        <View style={{ gap: 2 }}>
          <AppText variant="small">{t('weather.humidity', { value: Math.round(c.humidity) })}</AppText>
          <AppText variant="small">{t('weather.wind', { value: Math.round(c.wind_kmh) })}</AppText>
          <AppText variant="small">{t('weather.rain', { value: c.precipitation })}</AppText>
        </View>
      </Row>
      <ForecastStrip days={weather.daily} />
    </Card>
  );
}

export function ForecastStrip({ days }: { days: DailyForecast[] }) {
  const { i18n } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {days.map((d) => {
        const kind = weatherKind(d.weather_code);
        return (
          <View key={d.date} style={styles.day}>
            <AppText variant="small">{formatDate(d.date, i18n.language)}</AppText>
            <Ionicons name={kind.icon} size={24} color={colors.info} />
            <AppText style={{ fontWeight: '700' }}>{Math.round(d.temp_max)}°</AppText>
            <AppText variant="small">{Math.round(d.temp_min)}°</AppText>
            {d.rain_mm > 0.5 ? <AppText variant="small" style={{ color: colors.info }}>{Math.round(d.rain_mm)} mm</AppText> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  day: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minWidth: 68,
  },
});
