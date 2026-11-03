import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { pickCoverImage, pickStepMedia } from '../../../data/media/mediaService';
import {
  createRecipe,
  getRecipeById,
  updateRecipe,
} from '../../../data/repositories/recipeRepository';
import {
  createEmptyDraft,
  type Difficulty,
  type Ingredient,
  type RecipeDraft,
  type RecipeStep,
  type Tool,
} from '../../../domain/types';
import type { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { createId } from '../../../utils/id';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RecipeEditor'>;
type Route = RouteProp<RootStackParamList, 'RecipeEditor'>;
type StepIndex = 0 | 1 | 2;

const stepTitles = ['Datos generales', 'Materiales', 'Procedimiento'] as const;

export function RecipeEditorScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const recipeId = route.params?.recipeId;

  const [draft, setDraft] = useState<RecipeDraft>(createEmptyDraft());
  const [step, setStep] = useState<StepIndex>(0);
  const [loading, setLoading] = useState(Boolean(recipeId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recipeId) {
      setDraft({
        ...createEmptyDraft(),
        ingredientGroups: [
          {
            id: createId(),
            name: 'Ingredientes',
            sortOrder: 0,
            ingredients: [],
          },
        ],
      });
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const recipe = await getRecipeById(recipeId);
        if (!recipe) {
          Alert.alert('Error', 'No se encontró la receta');
          navigation.goBack();
          return;
        }
        setDraft({
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          coverImagePath: recipe.coverImagePath,
          ingredientGroups: recipe.ingredientGroups,
          tools: recipe.tools,
          steps: recipe.steps,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [recipeId, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: recipeId ? 'Editar receta' : 'Nueva receta',
    });
  }, [navigation, recipeId]);

  function updateDraft(patch: Partial<RecipeDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handlePickCover() {
    const path = await pickCoverImage();
    if (path) {
      updateDraft({ coverImagePath: path });
    }
  }

  function addIngredient() {
    const groups = [...draft.ingredientGroups];
    if (groups.length === 0) {
      groups.push({
        id: createId(),
        name: 'Ingredientes',
        sortOrder: 0,
        ingredients: [],
      });
    }
    const ingredient: Ingredient = {
      id: createId(),
      name: '',
      quantity: null,
      unit: null,
      note: null,
      optional: false,
      sortOrder: groups[0].ingredients.length,
    };
    groups[0] = {
      ...groups[0],
      ingredients: [...groups[0].ingredients, ingredient],
    };
    updateDraft({ ingredientGroups: groups });
  }

  function updateIngredient(ingredientId: string, patch: Partial<Ingredient>) {
    const groups = draft.ingredientGroups.map((group) => ({
      ...group,
      ingredients: group.ingredients.map((item) =>
        item.id === ingredientId ? { ...item, ...patch } : item,
      ),
    }));
    updateDraft({ ingredientGroups: groups });
  }

  function removeIngredient(ingredientId: string) {
    const groups = draft.ingredientGroups.map((group) => ({
      ...group,
      ingredients: group.ingredients.filter((item) => item.id !== ingredientId),
    }));
    updateDraft({ ingredientGroups: groups });
  }

  function addTool() {
    const tool: Tool = {
      id: createId(),
      name: '',
      note: null,
      sortOrder: draft.tools.length,
    };
    updateDraft({ tools: [...draft.tools, tool] });
  }

  function updateTool(toolId: string, patch: Partial<Tool>) {
    updateDraft({
      tools: draft.tools.map((tool) => (tool.id === toolId ? { ...tool, ...patch } : tool)),
    });
  }

  function removeTool(toolId: string) {
    updateDraft({ tools: draft.tools.filter((tool) => tool.id !== toolId) });
  }

  function addStep() {
    const next: RecipeStep = {
      id: createId(),
      stepNumber: draft.steps.length + 1,
      instruction: '',
      durationMinutes: null,
      tip: null,
      media: [],
    };
    updateDraft({ steps: [...draft.steps, next] });
  }

  function updateStep(stepId: string, patch: Partial<RecipeStep>) {
    updateDraft({
      steps: draft.steps.map((item) => (item.id === stepId ? { ...item, ...patch } : item)),
    });
  }

  function removeStep(stepId: string) {
    updateDraft({
      steps: draft.steps
        .filter((item) => item.id !== stepId)
        .map((item, index) => ({ ...item, stepNumber: index + 1 })),
    });
  }

  async function addMediaToStep(stepId: string) {
    const media = await pickStepMedia();
    if (!media) return;
    updateDraft({
      steps: draft.steps.map((item) =>
        item.id === stepId
          ? { ...item, media: [...item.media, { ...media, sortOrder: item.media.length }] }
          : item,
      ),
    });
  }

  function validateCurrentStep(): boolean {
    if (step === 0) {
      if (!draft.title.trim()) {
        Alert.alert('Falta el título', 'Poné un nombre a la receta.');
        return false;
      }
      return true;
    }
    if (step === 1) {
      const hasIngredient = draft.ingredientGroups.some((group) =>
        group.ingredients.some((item) => item.name.trim()),
      );
      if (!hasIngredient) {
        Alert.alert('Materiales', 'Agregá al menos un ingrediente.');
        return false;
      }
      return true;
    }
    if (draft.steps.length === 0 || draft.steps.some((item) => !item.instruction.trim())) {
      Alert.alert('Procedimiento', 'Agregá al menos un paso con instrucciones.');
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validateCurrentStep()) return;
    setSaving(true);
    try {
      const cleaned: RecipeDraft = {
        ...draft,
        title: draft.title.trim(),
        ingredientGroups: draft.ingredientGroups.map((group, groupIndex) => ({
          ...group,
          id: group.id || createId(),
          sortOrder: groupIndex,
          ingredients: group.ingredients
            .filter((item) => item.name.trim())
            .map((item, index) => ({ ...item, sortOrder: index })),
        })),
        tools: draft.tools
          .filter((tool) => tool.name.trim())
          .map((tool, index) => ({ ...tool, sortOrder: index })),
        steps: draft.steps.map((item, index) => ({
          ...item,
          stepNumber: index + 1,
          instruction: item.instruction.trim(),
        })),
      };

      if (recipeId) {
        await updateRecipe(recipeId, cleaned);
        navigation.goBack();
      } else {
        const id = await createRecipe(cleaned);
        navigation.replace('RecipeDetail', { recipeId: id });
      }
    } catch (error) {
      Alert.alert('Guardar', error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.progress}>
        {stepTitles.map((title, index) => (
          <View key={title} style={[styles.progressItem, index === step && styles.progressActive]}>
            <Text style={[styles.progressText, index === step && styles.progressTextActive]}>
              {index + 1}. {title}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <View style={styles.form}>
            <Field label="Título">
              <TextInput
                style={styles.input}
                value={draft.title}
                onChangeText={(title) => updateDraft({ title })}
                placeholder="Ej. Tarta de ricota"
                placeholderTextColor={colors.muted}
              />
            </Field>
            <Field label="Descripción">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={draft.description}
                onChangeText={(description) => updateDraft({ description })}
                placeholder="Breve intro de la receta"
                placeholderTextColor={colors.muted}
                multiline
              />
            </Field>
            <View style={styles.row}>
              <Field label="Porciones" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={String(draft.servings)}
                  onChangeText={(value) =>
                    updateDraft({ servings: Math.max(1, Number(value) || 1) })
                  }
                />
              </Field>
              <Field label="Prep (min)" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={String(draft.prepMinutes)}
                  onChangeText={(value) =>
                    updateDraft({ prepMinutes: Math.max(0, Number(value) || 0) })
                  }
                />
              </Field>
              <Field label="Cocción (min)" style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={String(draft.cookMinutes)}
                  onChangeText={(value) =>
                    updateDraft({ cookMinutes: Math.max(0, Number(value) || 0) })
                  }
                />
              </Field>
            </View>
            <Field label="Dificultad">
              <View style={styles.chips}>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                  <Pressable
                    key={level}
                    style={[styles.chip, draft.difficulty === level && styles.chipActive]}
                    onPress={() => updateDraft({ difficulty: level })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        draft.difficulty === level && styles.chipTextActive,
                      ]}
                    >
                      {level === 'easy' ? 'Fácil' : level === 'medium' ? 'Media' : 'Difícil'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label="Portada">
              <Pressable style={styles.secondaryButton} onPress={() => void handlePickCover()}>
                <Text style={styles.secondaryButtonText}>
                  {draft.coverImagePath ? 'Cambiar foto' : 'Elegir foto'}
                </Text>
              </Pressable>
              {draft.coverImagePath ? (
                <Image source={{ uri: draft.coverImagePath }} style={styles.coverPreview} />
              ) : null}
            </Field>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.form}>
            <Text style={styles.sectionLabel}>Ingredientes</Text>
            {draft.ingredientGroups[0]?.ingredients.map((ingredient) => (
              <View key={ingredient.id} style={styles.card}>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre"
                  placeholderTextColor={colors.muted}
                  value={ingredient.name}
                  onChangeText={(name) => updateIngredient(ingredient.id, { name })}
                />
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Cantidad"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={ingredient.quantity != null ? String(ingredient.quantity) : ''}
                    onChangeText={(value) =>
                      updateIngredient(ingredient.id, {
                        quantity: value ? Number(value) : null,
                      })
                    }
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Unidad"
                    placeholderTextColor={colors.muted}
                    value={ingredient.unit ?? ''}
                    onChangeText={(unit) => updateIngredient(ingredient.id, { unit: unit || null })}
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nota (opcional)"
                  placeholderTextColor={colors.muted}
                  value={ingredient.note ?? ''}
                  onChangeText={(note) => updateIngredient(ingredient.id, { note: note || null })}
                />
                <Pressable onPress={() => removeIngredient(ingredient.id)}>
                  <Text style={styles.removeText}>Quitar</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.secondaryButton} onPress={addIngredient}>
              <Text style={styles.secondaryButtonText}>+ Ingrediente</Text>
            </Pressable>

            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Herramientas</Text>
            {draft.tools.map((tool) => (
              <View key={tool.id} style={styles.card}>
                <TextInput
                  style={styles.input}
                  placeholder="Herramienta"
                  placeholderTextColor={colors.muted}
                  value={tool.name}
                  onChangeText={(name) => updateTool(tool.id, { name })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Nota"
                  placeholderTextColor={colors.muted}
                  value={tool.note ?? ''}
                  onChangeText={(note) => updateTool(tool.id, { note: note || null })}
                />
                <Pressable onPress={() => removeTool(tool.id)}>
                  <Text style={styles.removeText}>Quitar</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.secondaryButton} onPress={addTool}>
              <Text style={styles.secondaryButtonText}>+ Herramienta</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.form}>
            {draft.steps.map((item, index) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.stepHeading}>Paso {index + 1}</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Instrucción"
                  placeholderTextColor={colors.muted}
                  multiline
                  value={item.instruction}
                  onChangeText={(instruction) => updateStep(item.id, { instruction })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Duración (min)"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={item.durationMinutes != null ? String(item.durationMinutes) : ''}
                  onChangeText={(value) =>
                    updateStep(item.id, {
                      durationMinutes: value ? Number(value) : null,
                    })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Tip"
                  placeholderTextColor={colors.muted}
                  value={item.tip ?? ''}
                  onChangeText={(tip) => updateStep(item.id, { tip: tip || null })}
                />
                <View style={styles.mediaRow}>
                  {item.media.map((media) =>
                    media.type === 'image' ? (
                      <Image
                        key={media.id}
                        source={{ uri: media.compressedPath }}
                        style={styles.mediaThumb}
                      />
                    ) : (
                      <View key={media.id} style={styles.videoThumb}>
                        <Text style={styles.videoThumbText}>Video</Text>
                      </View>
                    ),
                  )}
                </View>
                <Pressable style={styles.secondaryButton} onPress={() => void addMediaToStep(item.id)}>
                  <Text style={styles.secondaryButtonText}>+ Foto o video</Text>
                </Pressable>
                <Pressable onPress={() => removeStep(item.id)}>
                  <Text style={styles.removeText}>Quitar paso</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.secondaryButton} onPress={addStep}>
              <Text style={styles.secondaryButtonText}>+ Paso</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable
            style={[styles.footerButton, styles.secondaryButton]}
            onPress={() => setStep((current) => (current - 1) as StepIndex)}
          >
            <Text style={styles.secondaryButtonText}>Atrás</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {step < 2 ? (
          <Pressable
            style={[styles.footerButton, styles.primaryButton]}
            onPress={() => {
              if (validateCurrentStep()) {
                setStep((current) => (current + 1) as StepIndex);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>Siguiente</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.footerButton, styles.primaryButton]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 8 },
  progressItem: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  progressActive: { backgroundColor: colors.accent },
  progressText: { fontSize: 11, textAlign: 'center', color: colors.accent, fontWeight: '600' },
  progressTextActive: { color: colors.white },
  content: { padding: 16, paddingBottom: 24 },
  form: { gap: 14 },
  label: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  secondaryButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.accent, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.white, fontWeight: '600' },
  coverPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 8,
  },
  removeText: { color: colors.danger, fontWeight: '600', marginTop: 2 },
  stepHeading: { fontWeight: '700', color: colors.accent },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumb: { width: 72, height: 72, borderRadius: 8 },
  videoThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbText: { color: colors.accent, fontWeight: '600', fontSize: 12 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.background,
  },
  footerButton: { flex: 1 },
});
