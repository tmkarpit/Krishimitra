import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, padded = true, edges }: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const inner = padded ? { padding: spacing.lg, gap: spacing.lg } : undefined;
  return (
    <SafeAreaView style={styles.screen} edges={edges ?? ['left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: spacing.xxl * 2 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type Variant = 'hero' | 'title' | 'subtitle' | 'body' | 'muted' | 'small' | 'label';

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  return <Text {...props} style={[styles.text, textVariants[variant], style]} />;
}

export function Card({ children, style, onPress, tone }: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  tone?: 'default' | 'primary' | 'warning' | 'danger' | 'info';
}) {
  const toneStyle = tone && tone !== 'default' ? { backgroundColor: toneBg[tone], borderColor: toneBg[tone] } : undefined;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, toneStyle, style, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style }: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = buttonVariants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.button, { backgroundColor: v.bg, borderColor: v.border }, inactive && styles.disabled, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Ionicons name={icon} size={22} color={v.fg} /> : null}
      <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.primary, size = 26, label, background }: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  background?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, background ? { backgroundColor: background } : null, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {icon ? <Ionicons name={icon} size={16} color={selected ? colors.white : colors.primary} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Input({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.multiline && { minHeight: 90 }, props.style]} />
    </View>
  );
}

export function Loading({ message }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <AppText variant="muted" style={{ textAlign: 'center' }}>{message}</AppText> : null}
    </View>
  );
}

export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown) => {
    const code = error instanceof ApiError ? error.code : 'generic';
    return t(`errors.${code}`, { defaultValue: t('errors.generic') });
  };
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message = useErrorMessage()(error);
  return (
    <Card tone="danger" style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        <Ionicons name="alert-circle" size={22} color={colors.danger} />
        <AppText style={{ flex: 1 }}>{message}</AppText>
      </View>
      {onRetry ? <Button title={t('common.retry')} variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </Card>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <Ionicons name={icon} size={44} color={colors.primary} />
      <AppText variant="subtitle" style={{ textAlign: 'center' }}>{title}</AppText>
      {body ? <AppText variant="muted" style={{ textAlign: 'center' }}>{body}</AppText> : null}
      {action}
    </Card>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <AppText variant="subtitle">{children}</AppText>
      {right}
    </View>
  );
}

export function Badge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'warning' | 'danger' | 'info' }) {
  return (
    <View style={[styles.badge, { backgroundColor: toneBg[tone] }]}>
      <Text style={[styles.badgeText, { color: toneFg[tone] }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <AppText variant="small">{label}</AppText>
      <AppText variant="subtitle">{value}</AppText>
    </View>
  );
}

const toneBg = { primary: colors.primaryLight, warning: colors.warningLight, danger: colors.dangerLight, info: colors.infoLight };
const toneFg = { primary: colors.primaryDark, warning: colors.warning, danger: colors.danger, info: colors.info };

const buttonVariants = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
};

const textVariants = StyleSheet.create({
  hero: { fontSize: font.hero, fontWeight: '700' },
  title: { fontSize: font.title, fontWeight: '700' },
  subtitle: { fontSize: font.large, fontWeight: '600' },
  body: { fontSize: font.body, lineHeight: 25 },
  muted: { fontSize: font.body, color: colors.textMuted, lineHeight: 24 },
  small: { fontSize: font.small, color: colors.textMuted },
  label: { fontSize: font.small, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  text: { color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: { fontSize: font.body, fontWeight: '700' },
  iconButton: { padding: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    minHeight: 40,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: font.body - 1, color: colors.primary, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    color: colors.text,
    minHeight: 52,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: font.small, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
});
