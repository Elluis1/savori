# Savori

Recetario móvil offline-first. Guardás recetas con pasos, materiales, herramientas y media comprimida en SQLite local, y las compartís como archivos `.savori` entre dispositivos.

## Stack

- React Native + Expo
- SQLite (`expo-sqlite`)
- React Navigation
- Media: `expo-image-picker` + `expo-image-manipulator`
- Intercambio: ZIP `.savori` (`jszip` + `expo-sharing` / `expo-document-picker`)

## Empezar

```bash
npm install
npx expo start
```

Escaneá el QR con Expo Go (Android/iOS) o abrí un emulador.

## Funciones MVP

1. Crear / editar / listar / eliminar recetas
2. Ingredientes, herramientas y pasos con tiempos
3. Fotos de portada y foto/video por paso (comprimidos)
4. Exportar e importar paquetes `.savori`

## Arquitectura

Ver [docs/architecture.md](docs/architecture.md).

## Repo

https://github.com/Elluis1/savori
