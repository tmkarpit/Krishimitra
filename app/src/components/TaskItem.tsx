import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { today, useSetTaskStatus } from '@/hooks/queries';
import { formatDate } from '@/lib/i18n';
import { colors, spacing } from '@/theme';
import type { PlanTask } from '@/types/db';
import { AppText, Badge, Row } from './ui';

export function TaskItem({ task, prefix }: { task: PlanTask; prefix?: string }) {
  const { t, i18n } = useTranslation();
  const setStatus = useSetTaskStatus();
  const done = task.status === 'done';
  const overdue = !done && task.due_date < today();

  return (
    <Row style={{ alignItems: 'flex-start', paddingVertical: spacing.sm }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={t('plan.markDone')}
        hitSlop={10}
        onPress={() => setStatus.mutate({ id: task.id, status: done ? 'pending' : 'done' })}
      >
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={30} color={done ? colors.primary : colors.textMuted} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={[{ fontWeight: '600' }, done && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
          {prefix ? `${prefix} ` : ''}{task.title}
        </AppText>
        {task.description && !done ? <AppText variant="small">{task.description}</AppText> : null}
        <Row>
          <AppText variant="small">{formatDate(task.due_date, i18n.language)}</AppText>
          {overdue ? <Badge label={t('plan.overdue')} tone="danger" /> : null}
        </Row>
      </View>
    </Row>
  );
}
