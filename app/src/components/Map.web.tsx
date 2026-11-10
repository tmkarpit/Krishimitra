// Web stand-in for react-native-maps, which only runs on Android/iOS.
// Keeps the browser preview working; field marking falls back to "Use my location".
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';

// Callers are typed against Map.tsx (react-native-maps); only the props used here are declared.
interface MapProps {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const MapView = forwardRef<{ animateToRegion: () => void }, MapProps>(function MapView({ style }, ref) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => {} }));
  return (
    <View style={[style, styles.box]}>
      <Ionicons name="map-outline" size={40} color={colors.primary} />
      <Text style={styles.text}>Map is available in the mobile app (Expo Go).</Text>
    </View>
  );
});

const Nothing = (_props: Record<string, unknown>) => null;

export default MapView;
export { Nothing as Circle, Nothing as Marker, Nothing as Polygon, Nothing as Polyline };

const styles = StyleSheet.create({
  box: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  text: { color: colors.textMuted, textAlign: 'center' },
});
