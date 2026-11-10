import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useStates } from '@/hooks/queries';
import { spacing } from '@/theme';
import { AppText, Chip, ChipRow, Input } from './ui';

export function StatePicker({ value, onChange }: { value: string | null; onChange: (code: string) => void }) {
  const { t } = useTranslation();
  const { data: states = [] } = useStates();
  const [query, setQuery] = useState('');
  const selected = states.find((s) => s.code === value);
  const q = query.trim().toLowerCase();
  const matches = q ? states.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{t('onboarding.state')}</AppText>
      {selected ? (
        <ChipRow>
          <Chip label={selected.name} selected icon="checkmark" onPress={() => setQuery('')} />
        </ChipRow>
      ) : null}
      <Input placeholder={t('onboarding.searchState')} value={query} onChangeText={setQuery} />
      {matches.length ? (
        <ChipRow>
          {matches.map((s) => (
            <Chip
              key={s.code}
              label={s.name}
              onPress={() => {
                onChange(s.code);
                setQuery('');
              }}
            />
          ))}
        </ChipRow>
      ) : null}
    </View>
  );
}
