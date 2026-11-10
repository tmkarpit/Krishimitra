import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { SpeakButton } from '@/components/SpeakButton';
import { AppText, Badge, Button, Card, ErrorView, Input, Loading, ProgressBar, Row, Screen, SectionTitle } from '@/components/ui';
import { useDiagnose, useDiseaseReports } from '@/hooks/queries';
import { formatDate } from '@/lib/i18n';
import { pickPhoto, type PhotoSource, uploadPhoto } from '@/lib/upload';
import { colors, radius, spacing } from '@/theme';
import type { DiseaseReport } from '@/types/db';

export default function DiagnoseScreen() {
  const { t, i18n } = useTranslation();
  const diagnose = useDiagnose();
  const history = useDiseaseReports();
  const [photo, setPhoto] = useState<string | null>(null);
  const [cropHint, setCropHint] = useState('');
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState<DiseaseReport | null>(null);

  async function choose(source: PhotoSource) {
    const uri = await pickPhoto(source);
    if (uri) {
      setPhoto(uri);
      setShown(null);
      diagnose.reset();
    }
  }

  async function run() {
    if (!photo) return;
    setUploading(true);
    try {
      const path = await uploadPhoto(photo, 'disease');
      const report = await diagnose.mutateAsync({ imagePath: path, cropHint: cropHint.trim() || undefined });
      setShown(report);
    } catch {
      // surfaced through diagnose.error
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || diagnose.isPending;

  return (
    <Screen>
      <AppText variant="muted">{t('diagnose.instructions')}</AppText>
      {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : (
        <View style={[styles.photo, styles.placeholder]}>
          <Ionicons name="leaf-outline" size={64} color={colors.primary} />
        </View>
      )}
      <Row>
        <Button title={t('diagnose.takePhoto')} icon="camera" onPress={() => choose('camera')} style={{ flex: 1 }} disabled={busy} />
        <Button title={t('diagnose.choosePhoto')} icon="images" variant="secondary" onPress={() => choose('gallery')} style={{ flex: 1 }} disabled={busy} />
      </Row>
      {photo && !shown ? (
        <>
          <Input label={t('diagnose.cropHint')} value={cropHint} onChangeText={setCropHint} />
          {busy ? <Loading message={t('diagnose.analysing')} /> : <Button title={t('diagnose.check')} icon="search" onPress={run} />}
        </>
      ) : null}
      {diagnose.error ? <ErrorView error={diagnose.error} /> : null}
      {shown ? <DiagnosisCard report={shown} /> : null}

      {history.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionTitle>{t('diagnose.history')}</SectionTitle>
          {history.data.map((r) => (
            <Card key={r.id} onPress={() => setShown(r)} style={{ gap: 2 }}>
              <AppText style={{ fontWeight: '700' }}>{r.is_healthy ? t('diagnose.healthy') : r.disease_name}</AppText>
              <AppText variant="small">{r.crop_name} · {formatDate(r.created_at, i18n.language)}</AppText>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function DiagnosisCard({ report }: { report: DiseaseReport }) {
  const { t } = useTranslation();
  const d = report.result;
  if (!d.is_plant_image) {
    return (
      <Card tone="warning" style={{ gap: spacing.sm }}>
        <AppText style={{ fontWeight: '700' }}>{t('diagnose.notPlant')}</AppText>
        <AppText>{d.retake_photo_tip}</AppText>
      </Card>
    );
  }
  const confidence = Math.round(d.confidence * 100);
  const sevTone = d.severity === 'high' ? 'danger' : d.severity === 'medium' ? 'warning' : 'primary';
  const list = (title: string, items: string[]) =>
    items.length ? (
      <View style={{ gap: 2 }}>
        <AppText variant="label">{title}</AppText>
        {items.map((i) => <AppText key={i}>• {i}</AppText>)}
      </View>
    ) : null;

  const spoken = [
    d.is_healthy ? t('diagnose.healthy') : d.problem_name,
    d.cause,
    ...d.organic_treatment,
    ...d.chemical_treatment,
    ...d.prevention,
    d.consult_expert ? t('diagnose.consultExpert') : '',
  ].filter(Boolean).join('. ');

  return (
    <Card style={{ gap: spacing.md }} tone={d.is_healthy ? 'primary' : 'default'}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="small">{d.crop_name}</AppText>
        <AppText variant="title">{d.is_healthy ? t('diagnose.healthy') : d.problem_name}</AppText>
        {!d.is_healthy ? <Badge label={t(`diagnose.severity_${d.severity}`)} tone={sevTone} /> : null}
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="small">{t('diagnose.confidence', { value: confidence })}</AppText>
        <ProgressBar value={confidence} color={confidence >= 60 ? colors.primary : colors.accent} />
      </View>
      {list(t('diagnose.symptoms'), d.symptoms_seen)}
      {d.cause ? (
        <View style={{ gap: 2 }}>
          <AppText variant="label">{t('diagnose.cause')}</AppText>
          <AppText>{d.cause}</AppText>
        </View>
      ) : null}
      {list(t('diagnose.organic'), d.organic_treatment)}
      {list(t('diagnose.chemical'), d.chemical_treatment)}
      {list(t('diagnose.prevention'), d.prevention)}
      {d.consult_expert ? (
        <Card tone="warning" style={{ gap: spacing.xs }}>
          <AppText>{t('diagnose.consultExpert')}</AppText>
          {d.retake_photo_tip ? <AppText variant="small">{d.retake_photo_tip}</AppText> : null}
        </Card>
      ) : null}
      <SpeakButton id={`diag-${report.id}`} text={spoken} />
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  placeholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
