export type Difficulty = 'easy' | 'medium' | 'hard';
export type MediaType = 'image' | 'video';

export interface MediaAsset {
  id: string;
  type: MediaType;
  originalPath: string;
  compressedPath: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  byteSize: number;
  sortOrder: number;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  optional: boolean;
  sortOrder: number;
}

export interface IngredientGroup {
  id: string;
  name: string;
  sortOrder: number;
  ingredients: Ingredient[];
}

export interface Tool {
  id: string;
  name: string;
  note: string | null;
  sortOrder: number;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  durationMinutes: number | null;
  tip: string | null;
  media: MediaAsset[];
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  difficulty: Difficulty;
  prepMinutes: number;
  cookMinutes: number;
  coverImagePath: string | null;
  createdAt: string;
  updatedAt: string;
  ingredientGroups: IngredientGroup[];
  tools: Tool[];
  steps: RecipeStep[];
}

export interface RecipeSummary {
  id: string;
  title: string;
  description: string;
  servings: number;
  difficulty: Difficulty;
  prepMinutes: number;
  cookMinutes: number;
  coverImagePath: string | null;
  updatedAt: string;
  stepCount: number;
}

export interface RecipeDraft {
  title: string;
  description: string;
  servings: number;
  difficulty: Difficulty;
  prepMinutes: number;
  cookMinutes: number;
  coverImagePath: string | null;
  ingredientGroups: IngredientGroup[];
  tools: Tool[];
  steps: RecipeStep[];
}

export const PACKAGE_FORMAT_VERSION = '1.0.0';

export interface RecipePackagePayload {
  formatVersion: string;
  exportedAt: string;
  recipe: Recipe;
}

export function createEmptyDraft(): RecipeDraft {
  return {
    title: '',
    description: '',
    servings: 2,
    difficulty: 'easy',
    prepMinutes: 0,
    cookMinutes: 0,
    coverImagePath: null,
    ingredientGroups: [
      {
        id: '',
        name: 'Ingredientes',
        sortOrder: 0,
        ingredients: [],
      },
    ],
    tools: [],
    steps: [],
  };
}

export function totalMinutes(recipe: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>): number {
  return recipe.prepMinutes + recipe.cookMinutes;
}
