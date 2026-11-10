import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { stopSpeaking } from '@/lib/speech';
import { ApiError, callFunction } from '@/lib/supabase';

const MAX_SECONDS = 45;

type Phase = 'idle' | 'recording' | 'transcribing';

/** Record → server speech-to-text. Works in Expo Go (no native speech-recognition module needed). */
export function useVoiceInput(language: string, onTranscript: (text: string) => void, onError: (code: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function start() {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      onError('mic_denied');
      return;
    }
    await stopSpeaking();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
    timer.current = setTimeout(() => void stop(), MAX_SECONDS * 1000);
  }

  async function stop() {
    if (timer.current) clearTimeout(timer.current);
    if (!recorder.isRecording) return;
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) {
      setPhase('idle');
      return;
    }
    setPhase('transcribing');
    try {
      const audio = await new File(uri).base64();
      const { transcript } = await callFunction<{ transcript: string }>('speech', {
        mode: 'stt',
        audio_base64: audio,
        mime_type: 'audio/m4a',
        language,
      });
      if (transcript) onTranscript(transcript);
      else onError('empty');
    } catch (err) {
      onError(err instanceof ApiError ? err.code : 'generic');
    } finally {
      setPhase('idle');
    }
  }

  return {
    phase,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    toggle: () => (phase === 'recording' ? stop() : phase === 'idle' ? start() : undefined),
  };
}
