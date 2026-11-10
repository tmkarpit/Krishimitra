import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState {
  /** null until the farmer picks a language on first launch */
  language: string | null;
  hydrated: boolean;
  setLanguage: (code: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      hydrated: false,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'krishimitra-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ language: s.language }),
      onRehydrateStorage: () => () => useSettings.setState({ hydrated: true }),
    },
  ),
);
