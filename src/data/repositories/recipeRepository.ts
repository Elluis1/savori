import type {
  Difficulty,
  Ingredient,
  IngredientGroup,
  MediaAsset,
  Recipe,
  RecipeDraft,
  RecipeStep,
  RecipeSummary,
  Tool,
} from '../../domain/types';
import { createId } from '../../utils/id';
import { getDatabase } from '../database';

type RecipeRow = {
  id: string;
  title: string;
  description: string;
  servings: number;
  difficulty: Difficulty;
  prep_minutes: number;
  cook_minutes: number;
  cover_image_path: string | null;
  created_at: string;
  updated_at: string;
};

type GroupRow = {
  id: string;
  name: string;
  sort_order: number;
};

type IngredientRow = {
  id: string;
  group_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  optional: number;
  sort_order: number;
};

type ToolRow = {
  id: string;
  name: string;
  note: string | null;
  sort_order: number;
};

type StepRow = {
  id: string;
  step_number: number;
  instruction: string;
  duration_minutes: number | null;
  tip: string | null;
};

type MediaRow = {
  id: string;
  recipe_id: string | null;
  step_id: string | null;
  type: 'image' | 'video';
  original_path: string;
  compressed_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  byte_size: number;
  sort_order: number;
};

function mapMedia(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    type: row.type,
    originalPath: row.original_path,
    compressedPath: row.compressed_path,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    byteSize: row.byte_size,
    sortOrder: row.sort_order,
  };
}

async function insertRecipeGraph(
  recipeId: string,
  draft: RecipeDraft,
  createdAt: string,
  updatedAt: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO recipes (
      id, title, description, servings, difficulty, prep_minutes, cook_minutes,
      cover_image_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recipeId,
      draft.title.trim(),
      draft.description.trim(),
      draft.servings,
      draft.difficulty,
      draft.prepMinutes,
      draft.cookMinutes,
      draft.coverImagePath,
      createdAt,
      updatedAt,
    ],
  );

  for (const [groupIndex, group] of draft.ingredientGroups.entries()) {
    const groupId = group.id || createId();
    await db.runAsync(
      `INSERT INTO ingredient_groups (id, recipe_id, name, sort_order) VALUES (?, ?, ?, ?)`,
      [groupId, recipeId, group.name.trim() || `Grupo ${groupIndex + 1}`, groupIndex],
    );

    for (const [ingredientIndex, ingredient] of group.ingredients.entries()) {
      await db.runAsync(
        `INSERT INTO ingredients (
          id, group_id, name, quantity, unit, note, optional, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ingredient.id || createId(),
          groupId,
          ingredient.name.trim(),
          ingredient.quantity,
          ingredient.unit,
          ingredient.note,
          ingredient.optional ? 1 : 0,
          ingredientIndex,
        ],
      );
    }
  }

  for (const [toolIndex, tool] of draft.tools.entries()) {
    await db.runAsync(
      `INSERT INTO tools (id, recipe_id, name, note, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [tool.id || createId(), recipeId, tool.name.trim(), tool.note, toolIndex],
    );
  }

  for (const [stepIndex, step] of draft.steps.entries()) {
    const stepId = step.id || createId();
    await db.runAsync(
      `INSERT INTO recipe_steps (
        id, recipe_id, step_number, instruction, duration_minutes, tip
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        stepId,
        recipeId,
        stepIndex + 1,
        step.instruction.trim(),
        step.durationMinutes,
        step.tip,
      ],
    );

    for (const [mediaIndex, media] of step.media.entries()) {
      await db.runAsync(
        `INSERT INTO media_assets (
          id, recipe_id, step_id, type, original_path, compressed_path,
          width, height, duration_seconds, byte_size, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          media.id || createId(),
          recipeId,
          stepId,
          media.type,
          media.originalPath,
          media.compressedPath,
          media.width,
          media.height,
          media.durationSeconds,
          media.byteSize,
          mediaIndex,
        ],
      );
    }
  }
}

async function deleteRecipeChildren(recipeId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM media_assets WHERE recipe_id = ?`, [recipeId]);
  await db.runAsync(`DELETE FROM recipe_steps WHERE recipe_id = ?`, [recipeId]);
  await db.runAsync(`DELETE FROM tools WHERE recipe_id = ?`, [recipeId]);

  const groups = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM ingredient_groups WHERE recipe_id = ?`,
    [recipeId],
  );
  for (const group of groups) {
    await db.runAsync(`DELETE FROM ingredients WHERE group_id = ?`, [group.id]);
  }
  await db.runAsync(`DELETE FROM ingredient_groups WHERE recipe_id = ?`, [recipeId]);
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RecipeRow & { step_count: number }>(
    `SELECT r.*,
      (SELECT COUNT(*) FROM recipe_steps s WHERE s.recipe_id = r.id) AS step_count
     FROM recipes r
     ORDER BY r.updated_at DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    difficulty: row.difficulty,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    coverImagePath: row.cover_image_path,
    updatedAt: row.updated_at,
    stepCount: row.step_count,
  }));
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  const db = await getDatabase();
  const recipe = await db.getFirstAsync<RecipeRow>(`SELECT * FROM recipes WHERE id = ?`, [id]);
  if (!recipe) return null;

  const groups = await db.getAllAsync<GroupRow>(
    `SELECT * FROM ingredient_groups WHERE recipe_id = ? ORDER BY sort_order ASC`,
    [id],
  );
  const ingredients = await db.getAllAsync<IngredientRow>(
    `SELECT i.* FROM ingredients i
     INNER JOIN ingredient_groups g ON g.id = i.group_id
     WHERE g.recipe_id = ?
     ORDER BY i.sort_order ASC`,
    [id],
  );
  const tools = await db.getAllAsync<ToolRow>(
    `SELECT * FROM tools WHERE recipe_id = ? ORDER BY sort_order ASC`,
    [id],
  );
  const steps = await db.getAllAsync<StepRow>(
    `SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number ASC`,
    [id],
  );
  const media = await db.getAllAsync<MediaRow>(
    `SELECT * FROM media_assets WHERE recipe_id = ? ORDER BY sort_order ASC`,
    [id],
  );

  const ingredientGroups: IngredientGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    sortOrder: group.sort_order,
    ingredients: ingredients
      .filter((item) => item.group_id === group.id)
      .map(
        (item): Ingredient => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          optional: item.optional === 1,
          sortOrder: item.sort_order,
        }),
      ),
  }));

  const recipeSteps: RecipeStep[] = steps.map((step) => ({
    id: step.id,
    stepNumber: step.step_number,
    instruction: step.instruction,
    durationMinutes: step.duration_minutes,
    tip: step.tip,
    media: media.filter((item) => item.step_id === step.id).map(mapMedia),
  }));

  const mappedTools: Tool[] = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    note: tool.note,
    sortOrder: tool.sort_order,
  }));

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    prepMinutes: recipe.prep_minutes,
    cookMinutes: recipe.cook_minutes,
    coverImagePath: recipe.cover_image_path,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
    ingredientGroups,
    tools: mappedTools,
    steps: recipeSteps,
  };
}

export async function createRecipe(draft: RecipeDraft): Promise<string> {
  const id = createId();
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await insertRecipeGraph(id, draft, now, now);
  });
  return id;
}

export async function updateRecipe(id: string, draft: RecipeDraft): Promise<void> {
  const existing = await getRecipeById(id);
  if (!existing) {
    throw new Error('Recipe not found');
  }

  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await deleteRecipeChildren(id);
    await db.runAsync(`DELETE FROM recipes WHERE id = ?`, [id]);
    await insertRecipeGraph(id, draft, existing.createdAt, now);
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await deleteRecipeChildren(id);
    await db.runAsync(`DELETE FROM recipes WHERE id = ?`, [id]);
  });
}

export async function importRecipe(recipe: Recipe): Promise<string> {
  const draft: RecipeDraft = {
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
  };
  return createRecipe(draft);
}
