import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { pickAndImportRecipePackage } from '../../../data/export/packageService';
import { listRecipes } from '../../../data/repositories/recipeRepository';
import type { RecipeSummary } from '../../../domain/types';
import { totalMinutes } from '../../../domain/types';
import type { RootStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RecipeList'>;

const difficultyLabel: Record<RecipeSummary['difficulty'], string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
};

export function RecipeListScreen() {
  const navigation = useNavigation<Nav>();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecipes(await listRecipes());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleImport() {
    setBusy(true);
    try {
      const id = await pickAndImportRecipePackage();
      await load();
      navigation.navigate('RecipeDetail', { recipeId: id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar';
      if (message !== 'Import cancelled') {
        Alert.alert('Importar', message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.brand}>Savori</Text>
        <Text style={styles.subtitle}>Tu recetario local, compartible entre dispositivos.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() => navigation.navigate('RecipeEditor', {})}
        >
          <Text style={styles.primaryText}>Nueva receta</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={() => void handleImport()}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>{busy ? 'Importando…' : 'Importar .savori'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Todavía no hay recetas. Creá la primera o importá un archivo.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
            >
              {item.coverImagePath ? (
                <Image source={{ uri: item.coverImagePath }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Text style={styles.coverPlaceholderText}>Sin foto</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {difficultyLabel[item.difficulty]} · {totalMinutes(item)} min · {item.stepCount} pasos
                </Text>
                {item.description ? (
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  brand: { fontSize: 34, fontWeight: '700', color: colors.ink, letterSpacing: -0.5 },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.accentSoft },
  primaryText: { color: colors.white, fontWeight: '600' },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  list: { padding: 20, gap: 14, paddingBottom: 40 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  cover: { width: '100%', height: 140 },
  coverPlaceholder: {
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: { color: colors.accent },
  cardBody: { padding: 14, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.ink },
  cardMeta: { color: colors.muted, fontSize: 13 },
  cardDescription: { color: colors.ink, opacity: 0.8, marginTop: 2 },
});
