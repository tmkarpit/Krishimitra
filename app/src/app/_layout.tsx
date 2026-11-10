import '@/lib/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile, useUpdateProfile } from '@/hooks/queries';
import { AuthProvider } from '@/providers/AuthProvider';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme';

/** Keeps i18next and the profile's language_code in step with the language the farmer picked. */
function LanguageSync() {
  const language = useSettings((s) => s.language);
  const { i18n } = useTranslation();
  const profile = useProfile();
  const update = useUpdateProfile();

  useEffect(() => {
    if (language && i18n.language !== language) void i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    if (language && profile.data && profile.data.language_code !== language && !update.isPending) {
      update.mutate({ language_code: language });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, profile.data?.language_code]);

  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000 } } }),
  );
  const { t } = useTranslation();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageSync />
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="language" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: t('onboarding.title') }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="field/new" options={{ title: t('field.newTitle') }} />
          <Stack.Screen name="field/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="field/[id]/soil" options={{ title: t('soil.title') }} />
          <Stack.Screen name="recommendation/[id]" options={{ title: t('reco.title') }} />
          <Stack.Screen name="plan/[id]" options={{ title: t('plan.title') }} />
          <Stack.Screen name="diagnose" options={{ title: t('diagnose.title') }} />
          <Stack.Screen name="schemes" options={{ title: t('schemes.title') }} />
          <Stack.Screen name="alerts" options={{ title: t('alerts.title') }} />
          <Stack.Screen name="value" options={{ title: t('value.title') }} />
          <Stack.Screen name="listing/new" options={{ title: t('produce.sellCrop') }} />
          <Stack.Screen name="listing/[id]" options={{ title: '' }} />
          <Stack.Screen name="shop/[id]" options={{ title: '' }} />
          <Stack.Screen name="shop/new" options={{ title: t('shop.addProduct') }} />
          <Stack.Screen name="orders" options={{ title: t('orders.title') }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
