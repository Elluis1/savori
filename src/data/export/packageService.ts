import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import {
  PACKAGE_FORMAT_VERSION,
  type MediaAsset,
  type Recipe,
  type RecipePackagePayload,
} from '../../domain/types';
import { createId } from '../../utils/id';
import { importMediaFromPackage } from '../media/mediaService';
import { getRecipeById, importRecipe } from '../repositories/recipeRepository';

const EXPORT_DIR = `${FileSystem.documentDirectory}savori-exports/`;
const IMPORT_DIR = `${FileSystem.cacheDirectory}savori-imports/`;

async function ensureDir(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'receta'
  );
}

async function collectMedia(recipe: Recipe): Promise<MediaAsset[]> {
  const items: MediaAsset[] = [];
  for (const step of recipe.steps) {
    items.push(...step.media);
  }
  return items;
}

export async function exportRecipePackage(recipeId: string): Promise<string> {
  const recipe = await getRecipeById(recipeId);
  if (!recipe) {
    throw new Error('Recipe not found');
  }

  await ensureDir(EXPORT_DIR);
  const zip = new JSZip();
  const mediaFolder = zip.folder('media');
  if (!mediaFolder) {
    throw new Error('Could not create media folder');
  }

  const pathMap = new Map<string, string>();
  const mediaItems = await collectMedia(recipe);

  if (recipe.coverImagePath) {
    const coverName = `cover-${createId()}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(recipe.coverImagePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    mediaFolder.file(coverName, base64, { base64: true });
    pathMap.set(recipe.coverImagePath, `media/${coverName}`);
  }

  for (const media of mediaItems) {
    if (pathMap.has(media.compressedPath)) continue;
    const ext = media.type === 'image' ? 'jpg' : media.compressedPath.split('.').pop() || 'mp4';
    const fileName = `${media.id}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(media.compressedPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    mediaFolder.file(fileName, base64, { base64: true });
    pathMap.set(media.compressedPath, `media/${fileName}`);
  }

  const remapped: Recipe = {
    ...recipe,
    coverImagePath: recipe.coverImagePath
      ? pathMap.get(recipe.coverImagePath) ?? null
      : null,
    steps: recipe.steps.map((step) => ({
      ...step,
      media: step.media.map((media) => ({
        ...media,
        originalPath: pathMap.get(media.compressedPath) ?? media.originalPath,
        compressedPath: pathMap.get(media.compressedPath) ?? media.compressedPath,
      })),
    })),
  };

  const payload: RecipePackagePayload = {
    formatVersion: PACKAGE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    recipe: remapped,
  };

  zip.file('recipe.json', JSON.stringify(payload, null, 2));

  const base64Zip = await zip.generateAsync({ type: 'base64' });
  const outPath = `${EXPORT_DIR}${slugify(recipe.title)}.savori`;
  await FileSystem.writeAsStringAsync(outPath, base64Zip, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(outPath, {
      mimeType: 'application/zip',
      dialogTitle: 'Compartir receta Savori',
      UTI: 'public.zip-archive',
    });
  }

  return outPath;
}

export async function pickAndImportRecipePackage(): Promise<string> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.[0]) {
    throw new Error('Import cancelled');
  }

  return importRecipePackage(picked.assets[0].uri);
}

export async function importRecipePackage(uri: string): Promise<string> {
  await ensureDir(IMPORT_DIR);
  const zipBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zip = await JSZip.loadAsync(zipBase64, { base64: true });
  const recipeFile = zip.file('recipe.json');
  if (!recipeFile) {
    throw new Error('Invalid .savori package: missing recipe.json');
  }

  const payload = JSON.parse(await recipeFile.async('string')) as RecipePackagePayload;
  if (!payload.formatVersion || !payload.recipe) {
    throw new Error('Invalid .savori package payload');
  }

  const recipe = payload.recipe;
  const tempExtract = `${IMPORT_DIR}${createId()}/`;
  await ensureDir(tempExtract);

  async function materializePackagePath(relativePath: string | null): Promise<string | null> {
    if (!relativePath) return null;
    const entry = zip.file(relativePath);
    if (!entry) return null;

    const localTemp = `${tempExtract}${relativePath.split('/').pop()}`;
    const base64 = await entry.async('base64');
    await FileSystem.writeAsStringAsync(localTemp, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isImage =
      relativePath.endsWith('.jpg') ||
      relativePath.endsWith('.jpeg') ||
      relativePath.endsWith('.png') ||
      relativePath.endsWith('.webp');

    const imported = await importMediaFromPackage(localTemp, isImage ? 'image' : 'video');
    return imported.path;
  }

  const coverImagePath = await materializePackagePath(recipe.coverImagePath);

  const steps = [];
  for (const step of recipe.steps) {
    const media = [];
    for (const item of step.media) {
      const path = await materializePackagePath(item.compressedPath);
      if (!path) continue;
      const info = await FileSystem.getInfoAsync(path);
      media.push({
        ...item,
        id: createId(),
        originalPath: path,
        compressedPath: path,
        byteSize: info.exists && 'size' in info ? (info.size as number) : item.byteSize,
      });
    }
    steps.push({
      ...step,
      id: createId(),
      media,
    });
  }

  const importedRecipe: Recipe = {
    ...recipe,
    id: createId(),
    coverImagePath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ingredientGroups: recipe.ingredientGroups.map((group) => ({
      ...group,
      id: createId(),
      ingredients: group.ingredients.map((ingredient) => ({
        ...ingredient,
        id: createId(),
      })),
    })),
    tools: recipe.tools.map((tool) => ({
      ...tool,
      id: createId(),
    })),
    steps,
  };

  return importRecipe(importedRecipe);
}
