import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { create } from 'zustand';
import { languageInfo } from './i18n';
import { callFunction } from './supabase';

// ---------------------------------------------------------------------------
// Text to speech: phone voice first, server (Sarvam) voice when the phone has none.
// ---------------------------------------------------------------------------
interface SpeakerState {
  speakingId: string | null;
}
export const useSpeaker = create<SpeakerState>(() => ({ speakingId: null }));

let voiceLanguages: Promise<Set<string>> | null = null;
let player: AudioPlayer | null = null;

function deviceLanguages(): Promise<Set<string>> {
  voiceLanguages ??= Speech.getAvailableVoicesAsync()
    .then((voices) => new Set(voices.map((v) => v.language.slice(0, 2).toLowerCase())))
    .catch(() => new Set<string>());
  return voiceLanguages;
}

export function cleanForSpeech(text: string): string {
  return text.replace(/[*#_`>|~]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function stopSpeaking() {
  useSpeaker.setState({ speakingId: null });
  await Speech.stop();
  if (player) {
    player.pause();
    player.remove();
    player = null;
  }
}

export async function speak(id: string, text: string, lang: string) {
  await stopSpeaking();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  useSpeaker.setState({ speakingId: id });
  const done = () => {
    if (useSpeaker.getState().speakingId === id) useSpeaker.setState({ speakingId: null });
  };

  const hasDeviceVoice = (await deviceLanguages()).has(lang === 'or' ? 'or' : lang);
  if (hasDeviceVoice || lang === 'en') {
    Speech.speak(clean, { language: languageInfo(lang).bcp47, rate: 0.95, onDone: done, onStopped: done, onError: done });
    return;
  }

  try {
    const { audio_base64 } = await callFunction<{ audio_base64: string }>('speech', { mode: 'tts', text: clean, language: lang });
    if (useSpeaker.getState().speakingId !== id) return; // stopped while loading
    const file = new File(Paths.cache, `tts-${Date.now()}.wav`);
    file.create();
    await file.write(audio_base64, { encoding: 'base64' });
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    player = createAudioPlayer(file.uri);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) done();
    });
    player.play();
  } catch {
    // Last resort: let the phone try anyway (may read in an English voice).
    Speech.speak(clean, { language: languageInfo(lang).bcp47, onDone: done, onStopped: done, onError: done });
  }
}

export async function toggleSpeak(id: string, text: string, lang: string) {
  if (useSpeaker.getState().speakingId === id) await stopSpeaking();
  else await speak(id, text, lang);
}
