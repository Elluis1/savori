import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { RecipeDetailScreen } from '../features/recipes/screens/RecipeDetailScreen';
import { RecipeEditorScreen } from '../features/recipes/screens/RecipeEditorScreen';
import { RecipeListScreen } from '../features/recipes/screens/RecipeListScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="RecipeList"
          component={RecipeListScreen}
          options={{ title: 'Savori' }}
        />
        <Stack.Screen
          name="RecipeDetail"
          component={RecipeDetailScreen}
          options={{ title: 'Receta' }}
        />
        <Stack.Screen
          name="RecipeEditor"
          component={RecipeEditorScreen}
          options={{ title: 'Editar receta' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
