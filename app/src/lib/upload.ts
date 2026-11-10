import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { currentUserId, supabase } from './supabase';

export type PhotoSource = 'camera' | 'gallery';

/** Lets the farmer take or choose a photo. Returns null if cancelled or permission denied. */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0]?.uri ?? null;
}

/** Shrinks the photo (saves rural mobile data) and uploads it to the private bucket. */
export async function uploadPhoto(uri: string, folder: 'chat' | 'disease' | 'soil-card' | 'valuation'): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1024 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });

  const userId = await currentUserId();
  const path = `${userId}/${folder}/${Date.now()}.jpg`;
  const bytes = await new File(saved.uri).arrayBuffer();
  const { error } = await supabase.storage.from('uploads').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

/** Uploads a photo other users must see (produce listings, shop products) and returns its public URL. */
export async function uploadPublicPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1024 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });

  const userId = await currentUserId();
  const path = `${userId}/${Date.now()}.jpg`;
  const bytes = await new File(saved.uri).arrayBuffer();
  const { error } = await supabase.storage.from('public-photos').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('public-photos').getPublicUrl(path).data.publicUrl;
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('uploads').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
