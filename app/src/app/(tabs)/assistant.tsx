import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { type ComponentRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SpeakButton } from '@/components/SpeakButton';
import { AppText, Chip, ChipRow, IconButton, Row, useErrorMessage } from '@/components/ui';
import { useProfile } from '@/hooks/queries';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { speak } from '@/lib/speech';
import { callFunction } from '@/lib/supabase';
import { pickPhoto, type PhotoSource, uploadPhoto } from '@/lib/upload';
import { colors, font, radius, spacing } from '@/theme';
import type { ChatMessage } from '@/types/db';

interface UiMessage extends Pick<ChatMessage, 'id' | 'role' | 'content'> {
  localImage?: string;
  pending?: boolean;
}

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const profile = useProfile();
  const errorMessage = useErrorMessage();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (vars: { text: string; image: string | null }) => {
      const imagePath = vars.image ? await uploadPhoto(vars.image, 'chat') : undefined;
      return callFunction<{ session_id: string; messages: ChatMessage[] }>('chat', {
        session_id: sessionId,
        message: vars.text,
        image_path: imagePath,
        language: i18n.language,
      });
    },
    onSuccess: (res) => {
      setSessionId(res.session_id);
      const reply = res.messages.find((m) => m.role === 'assistant');
      setMessages((prev) => [...prev.filter((m) => !m.pending || m.role === 'user').map((m) => ({ ...m, pending: false })), ...(reply ? [reply] : [])]);
      if (reply && profile.data?.voice_autoplay) void speak(reply.id, reply.content, i18n.language);
    },
    onError: (err) => {
      setMessages((prev) => prev.filter((m) => !m.pending));
      setNotice(errorMessage(err));
    },
  });

  const voice = useVoiceInput(
    i18n.language,
    (text) => submit(text),
    (code) => setNotice(code === 'speech_not_configured' ? t('assistant.voiceUnavailable') : code === 'mic_denied' ? t('assistant.micDenied') : t('errors.generic')),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Row style={{ marginRight: spacing.sm }}>
          <IconButton icon="bug-outline" color={colors.white} label={t('diagnose.title')} onPress={() => router.push('/diagnose')} />
          <IconButton icon="add-circle-outline" color={colors.white} label={t('assistant.newChat')} onPress={newChat} />
        </Row>
      ),
    });
  });

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(id);
  }, [messages.length]);

  function newChat() {
    setSessionId(null);
    setMessages([]);
    setNotice(null);
  }

  function submit(text = input) {
    const trimmed = text.trim();
    if ((!trimmed && !image) || send.isPending) return;
    setNotice(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: trimmed, localImage: image ?? undefined, pending: true }]);
    send.mutate({ text: trimmed, image });
    setInput('');
    setImage(null);
  }

  function attach() {
    const pick = async (source: PhotoSource) => {
      const uri = await pickPhoto(source);
      if (uri) setImage(uri);
    };
    Alert.alert(t('assistant.attachPhoto'), undefined, [
      { text: t('common.camera'), onPress: () => void pick('camera') },
      { text: t('common.gallery'), onPress: () => void pick('gallery') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  const busy = send.isPending || voice.phase === 'transcribing';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={[styles.bubble, styles.assistant]}>
          <AppText>{t('assistant.welcome')}</AppText>
        </View>
        {messages.length === 0 ? (
          <ChipRow>
            {(['s1', 's2', 's3'] as const).map((k) => (
              <Chip key={k} label={t(`assistant.suggestions.${k}`)} onPress={() => submit(t(`assistant.suggestions.${k}`))} />
            ))}
          </ChipRow>
        ) : null}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.user : styles.assistant]}>
            {m.localImage ? <Image source={{ uri: m.localImage }} style={styles.photo} /> : null}
            {m.content ? <AppText style={m.role === 'user' ? { color: colors.white } : undefined}>{m.content}</AppText> : null}
            {m.role === 'assistant' ? <SpeakButton id={m.id} text={m.content} /> : null}
          </View>
        ))}
        {busy ? (
          <Row>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="muted">{voice.phase === 'transcribing' ? t('assistant.transcribing') : t('assistant.thinking')}</AppText>
          </Row>
        ) : null}
        {notice ? <AppText style={{ color: colors.danger }}>{notice}</AppText> : null}
      </ScrollView>

      {image ? (
        <Row style={styles.preview}>
          <Image source={{ uri: image }} style={{ width: 56, height: 56, borderRadius: radius.sm }} />
          <AppText variant="small" style={{ flex: 1 }}>{t('assistant.photoAttached')}</AppText>
          <IconButton icon="close-circle" color={colors.danger} label={t('common.cancel')} onPress={() => setImage(null)} />
        </Row>
      ) : null}

      {voice.phase === 'recording' ? (
        <Pressable style={styles.recording} onPress={voice.toggle}>
          <Ionicons name="mic" size={28} color={colors.white} />
          <AppText style={{ color: colors.white, fontWeight: '700' }}>{t('assistant.listening')} {voice.seconds}s</AppText>
        </Pressable>
      ) : (
        <View style={styles.inputBar}>
          <IconButton icon="camera" label={t('assistant.attachPhoto')} onPress={attach} />
          <TextInput
            style={styles.input}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          {input.trim() || image ? (
            <IconButton icon="send" label={t('common.send')} color={colors.white} background={colors.primary} onPress={() => submit()} />
          ) : (
            <IconButton icon="mic" label={t('assistant.holdToTalk')} color={colors.white} background={colors.primary} size={28} onPress={() => void voice.toggle()} />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: spacing.md, borderRadius: radius.lg, maxWidth: '88%', gap: spacing.sm },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  assistant: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  photo: { width: 200, height: 150, borderRadius: radius.md },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    fontSize: font.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    color: colors.text,
  },
  preview: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  recording: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.danger,
  },
});
