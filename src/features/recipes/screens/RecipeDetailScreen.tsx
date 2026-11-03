import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { exportRecipePackage } from '../../../data/export/packageService';
import { deleteRecipe, getRecipeById } from '../../../data/repositories/recipeRepository';
import type { Recipe } from '../../../domain/types';
import { totalMinutes } from '../../../domain/types';
import type { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RecipeDetail'>;
type Route = RouteProp<RootStackParamList, 'RecipeDetail'>;

const difficultyLabel = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
} as const;

export function RecipeDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecipe(await getRecipeById(recipeId));
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: recipe?.title ?? 'Receta',
    });
  }, [navigation, recipe?.title]);

  async function handleExport() {
    setBusy(true);
    try {
      await exportRecipePackage(recipeId);
    } catch (error) {
      Alert.alert('Exportar', error instanceof Error ? error.message : 'Error al exportar');
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    Alert.alert('Eliminar receta', '¿Seguro que querés borrarla de este dispositivo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteRecipe(recipeId);
            navigation.goBack();
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>No se encontró la receta.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {recipe.coverImagePath ? (
        <Image source={{ uri: recipe.coverImagePath }} style={styles.cover} />
      ) : null}

      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}

      <View style={styles.metaRow}>
        <Meta label="Dificultad" value={difficultyLabel[recipe.difficulty]} />
        <Meta label="Porciones" value={String(recipe.servings)} />
        <Meta label="Tiempo" value={`${totalMinutes(recipe)} min`} />
      </View>
      <Text style={styles.timeDetail}>
        Prep {recipe.prepMinutes} min · Cocción {recipe.cookMinutes} min
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() => navigation.navigate('RecipeEditor', { recipeId })}
        >
          <Text style={styles.primaryText}>Editar</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={() => void handleExport()}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>{busy ? 'Exportando…' : 'Exportar'}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.danger]} onPress={handleDelete}>
          <Text style={styles.dangerText}>Borrar</Text>
        </Pressable>
      </View>

      <Section title="Ingredientes">
        {recipe.ingredientGroups.map((group) => (
          <View key={group.id} style={styles.block}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            {group.ingredients.map((ingredient) => (
              <Text key={ingredient.id} style={styles.item}>
                • {ingredient.quantity != null ? `${ingredient.quantity} ` : ''}
                {ingredient.unit ? `${ingredient.unit} ` : ''}
                {ingredient.name}
                {ingredient.optional ? ' (opcional)' : ''}
                {ingredient.note ? ` — ${ingredient.note}` : ''}
              </Text>
            ))}
          </View>
        ))}
      </Section>

      <Section title="Herramientas">
        {recipe.tools.length === 0 ? (
          <Text style={styles.muted}>Sin herramientas cargadas.</Text>
        ) : (
          recipe.tools.map((tool) => (
            <Text key={tool.id} style={styles.item}>
              • {tool.name}
              {tool.note ? ` — ${tool.note}` : ''}
            </Text>
          ))
        )}
      </Section>

      <Section title="Procedimiento">
        {recipe.steps.map((step) => (
          <View key={step.id} style={styles.step}>
            <Text style={styles.stepNumber}>Paso {step.stepNumber}</Text>
            <Text style={styles.item}>{step.instruction}</Text>
            {step.durationMinutes != null ? (
              <Text style={styles.muted}>{step.durationMinutes} min</Text>
            ) : null}
            {step.tip ? <Text style={styles.tip}>Tip: {step.tip}</Text> : null}
            <View style={styles.mediaRow}>
              {step.media.map((media) =>
                media.type === 'image' ? (
                  <Image
                    key={media.id}
                    source={{ uri: media.compressedPath }}
                    style={styles.stepImage}
                  />
                ) : (
                  <View key={media.id} style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>
                      Video{media.durationSeconds ? ` · ${media.durationSeconds}s` : ''}
                    </Text>
                  </View>
                ),
              )}
            </View>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', height: 220 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  description: {
    paddingHorizontal: 20,
    marginTop: 8,
    color: colors.muted,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  meta: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
  },
  metaLabel: { color: colors.muted, fontSize: 12 },
  metaValue: { color: colors.ink, fontWeight: '600', marginTop: 2 },
  timeDetail: { paddingHorizontal: 20, marginTop: 8, color: colors.muted },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 16 },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.accentSoft },
  danger: { backgroundColor: '#F8E4E1' },
  primaryText: { color: colors.white, fontWeight: '600' },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  dangerText: { color: colors.danger, fontWeight: '600' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  block: { marginBottom: 12 },
  groupTitle: { fontWeight: '600', color: colors.ink, marginBottom: 4 },
  item: { color: colors.ink, lineHeight: 22, marginBottom: 4 },
  muted: { color: colors.muted },
  step: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  stepNumber: { fontWeight: '700', color: colors.accent },
  tip: { color: colors.success, fontStyle: 'italic' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  stepImage: { width: 96, height: 96, borderRadius: 10 },
  videoBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  videoBadgeText: { color: colors.accent, fontWeight: '600' },
});
