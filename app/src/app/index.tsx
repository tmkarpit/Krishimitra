import { Redirect } from 'expo-router';
import { ErrorView, Loading, Screen } from '@/components/ui';
import { useProfile } from '@/hooks/queries';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/store/settings';

/** Startup gate: language → sign-in → onboarding → home. */
export default function Index() {
  const { hydrated, language } = useSettings();
  const { session, loading } = useAuth();
  const profile = useProfile();

  if (!hydrated || loading) return <Loading />;
  if (!language) return <Redirect href="/language" />;
  if (!session) return <Redirect href="/login" />;
  if (profile.isLoading) return <Loading />;
  if (profile.error) {
    return (
      <Screen>
        <ErrorView error={profile.error} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  if (!profile.data?.onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
