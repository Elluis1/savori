import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { createId } from '../../utils/id';
import type { MediaAsset, MediaType } from '../../domain/types';

const MEDIA_ROOT = `${FileSystem.documentDirectory}savori-media/`;
const MAX_IMAGE_SIDE = 1280;
const IMAGE_COMPRESS = 0.82;
const VIDEO_MAX_DURATION_SEC = 60;

async function ensureMediaRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MEDIA_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_ROOT, { intermediates: true });
  }
}

async function fileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && 'size' in info && typeof info.size === 'number') {
    return info.size;
  }
  return 0;
}

export async function pickCoverImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: true,
    aspect: [16, 9],
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return compressAndStoreImage(result.assets[0].uri);
}

export async function pickStepMedia(): Promise<MediaAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
    videoMaxDuration: VIDEO_MAX_DURATION_SEC,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  if (asset.type === 'video') {
    return storeVideo(asset);
  }

  const compressedPath = await compressAndStoreImage(asset.uri);
  const size = await fileSize(compressedPath);
  return {
    id: createId(),
    type: 'image',
    originalPath: asset.uri,
    compressedPath,
    width: asset.width ?? null,
    height: asset.height ?? null,
    durationSeconds: null,
    byteSize: size,
    sortOrder: 0,
  };
}

export async function compressAndStoreImage(sourceUri: string): Promise<string> {
  await ensureMediaRoot();
  const manipulated = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: MAX_IMAGE_SIDE } }],
    {
      compress: IMAGE_COMPRESS,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const dest = `${MEDIA_ROOT}${createId()}.jpg`;
  await FileSystem.copyAsync({ from: manipulated.uri, to: dest });
  return dest;
}

async function storeVideo(asset: ImagePicker.ImagePickerAsset): Promise<MediaAsset> {
  await ensureMediaRoot();
  const ext = asset.uri.split('.').pop()?.toLowerCase() || 'mp4';
  const dest = `${MEDIA_ROOT}${createId()}.${ext}`;
  await FileSystem.copyAsync({ from: asset.uri, to: dest });
  const size = await fileSize(dest);

  return {
    id: createId(),
    type: 'video',
    originalPath: asset.uri,
    compressedPath: dest,
    width: asset.width ?? null,
    height: asset.height ?? null,
    durationSeconds: asset.duration != null ? Math.round(asset.duration / 1000) : null,
    byteSize: size,
    sortOrder: 0,
  };
}

export async function importMediaFromPackage(
  sourceUri: string,
  type: MediaType,
): Promise<{ path: string; byteSize: number }> {
  await ensureMediaRoot();
  const ext = type === 'image' ? 'jpg' : sourceUri.split('.').pop() || 'mp4';
  const dest = `${MEDIA_ROOT}${createId()}.${ext}`;

  if (type === 'image') {
    const compressed = await compressAndStoreImage(sourceUri);
    return { path: compressed, byteSize: await fileSize(compressed) };
  }

  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return { path: dest, byteSize: await fileSize(dest) };
}

export async function deleteMediaFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    // Best-effort cleanup.
  }
}
