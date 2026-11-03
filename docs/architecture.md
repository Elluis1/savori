# Savori — Arquitectura

App React Native (Expo) offline-first para guardar y compartir recetas como documentos portables (`.savori`).

## Decisiones

- **Stack:** React Native + Expo
- **BD:** SQLite (`expo-sqlite`) en el dispositivo
- **Media:** archivos locales comprimidos; la BD solo guarda metadatos y paths
- **Intercambio:** paquete ZIP `.savori` con `recipe.json` + `media/`
- **Sin backend** en el MVP

## Diagrama de clases

```mermaid
classDiagram
  direction TB

  class Recipe {
    +String id
    +String title
    +String description
    +int servings
    +String difficulty
    +int prepMinutes
    +int cookMinutes
    +String coverImagePath
    +DateTime createdAt
    +DateTime updatedAt
  }

  class IngredientGroup {
    +String id
    +String name
    +int sortOrder
  }

  class Ingredient {
    +String id
    +String name
    +double quantity
    +String unit
    +String note
    +bool optional
    +int sortOrder
  }

  class Tool {
    +String id
    +String name
    +String note
  }

  class RecipeStep {
    +String id
    +int stepNumber
    +String instruction
    +int durationMinutes
    +String tip
  }

  class MediaAsset {
    +String id
    +String type
    +String originalPath
    +String compressedPath
    +int width
    +int height
    +int durationSeconds
    +int byteSize
  }

  class RecipePackage {
    +String formatVersion
    +Recipe recipe
    +export()
    +import()
  }

  Recipe "1" --> "*" IngredientGroup : has
  IngredientGroup "1" --> "*" Ingredient : contains
  Recipe "1" --> "*" Tool : needs
  Recipe "1" --> "*" RecipeStep : procedure
  Recipe "0..1" --> "0..1" MediaAsset : cover
  RecipeStep "1" --> "*" MediaAsset : photos_videos
  RecipePackage --> Recipe : wraps
```

## Flujos MVP

```mermaid
flowchart LR
  create[Crear receta] --> header[Datos generales]
  header --> materials[Ingredientes y herramientas]
  materials --> steps[Pasos con media]
  steps --> compress[Comprimir fotos y videos]
  compress --> save[Guardar BD local]
  save --> exportNode[Exportar paquete]
  exportNode --> share[Compartir archivo]
  share --> importNode[Importar en otro dispositivo]
  importNode --> save
```

## Capas del código

| Carpeta | Rol |
|---------|-----|
| `src/domain` | Tipos del dominio |
| `src/data` | SQLite, repositorio, media, export/import |
| `src/features/recipes` | Pantallas del flujo de recetas |
| `src/navigation` | React Navigation |
| `src/theme` | Tokens visuales |

## Política de media

- Fotos: resize máx. 1280px, JPEG ~82%
- Videos: se copian al sandbox con límite de duración en el picker (60s)
- Paths en SQLite; archivos en `documentDirectory/savori-media/`

## Formato `.savori`

```
recipe.json
media/
  cover-....jpg
  <media-id>.jpg|mp4
```

`recipe.json` incluye `formatVersion`, `exportedAt` y el grafo completo de la receta con paths relativos a `media/`.
