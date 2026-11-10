import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/store/settings';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const language = useSettings((s) => s.language) ?? 'en';
  const [digits, setDigits] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState<'otp' | 'verify' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phone = `+91${digits}`;

  async function sendOtp() {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t('login.invalidPhone'));
      return;
    }
    setBusy('otp');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ phone, options: { data: { language } } });
    setBusy(null);
    if (err) setError(err.message);
    else setStage('otp');
  }

  async function verify() {
    setBusy('verify');
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    setBusy(null);
    if (err) setError(t('login.invalidOtp'));
    else router.replace('/');
  }

  async function guest() {
    setBusy('guest');
    setError(null);
    const { error: err } = await supabase.auth.signInAnonymously({ options: { data: { language } } });
    setBusy(null);
    if (err) setError(err.message);
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.hero}>
          <Ionicons name="leaf" size={56} color={colors.white} />
          <AppText variant="hero" style={{ color: colors.white }}>KrishiMitra</AppText>
          <AppText style={{ color: colors.primaryLight, textAlign: 'center' }}>{t('common.tagline')}</AppText>
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <AppText variant="title">{t('login.title')}</AppText>
          {stage === 'phone' ? (
            <>
              <Input
                label={t('login.phoneLabel')}
                placeholder={t('login.phonePlaceholder')}
                keyboardType="phone-pad"
                maxLength={10}
                value={digits}
                onChangeText={(v) => setDigits(v.replace(/\D/g, ''))}
              />
              <Button title={t('login.sendOtp')} icon="chatbox-ellipses" loading={busy === 'otp'} onPress={sendOtp} />
            </>
          ) : (
            <>
              <AppText variant="muted">{t('login.otpLabel', { phone })}</AppText>
              <Input
                placeholder="______"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, ''))}
                style={{ fontSize: 26, letterSpacing: 10, textAlign: 'center' }}
              />
              <Button title={t('login.verify')} icon="checkmark-circle" loading={busy === 'verify'} disabled={otp.length !== 6} onPress={verify} />
              <Button title={t('login.changeNumber')} variant="ghost" onPress={() => setStage('phone')} />
            </>
          )}
          {error ? (
            <Card tone="danger">
              <AppText>{error}</AppText>
            </Card>
          ) : null}
          <View style={styles.divider} />
          <Button title={t('login.guest')} variant="secondary" icon="person-outline" loading={busy === 'guest'} onPress={guest} />
          <AppText variant="small" style={{ textAlign: 'center' }}>{t('login.guestNote')}</AppText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { backgroundColor: colors.primary, alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
});
