import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import type { IconName } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

const tabIcon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size + 2} />;
  };

export default function TabsLayout() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { minHeight: 60 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('tabs.home'), headerTitle: 'KrishiMitra', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="farm" options={{ title: t('tabs.farm'), tabBarIcon: tabIcon('map') }} />
      <Tabs.Screen name="assistant" options={{ title: t('tabs.assistant'), headerTitle: t('assistant.title'), tabBarIcon: tabIcon('chatbubbles') }} />
      <Tabs.Screen name="market" options={{ title: t('tabs.market'), headerTitle: t('market.title'), tabBarIcon: tabIcon('pricetags') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person-circle') }} />
    </Tabs>
  );
}
