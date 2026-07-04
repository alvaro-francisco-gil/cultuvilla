const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(workspaceRoot, 'packages'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Expo SDK 56's getDefaultConfig omits 'web' from resolver.platforms, so `.web.tsx`
// overrides silently don't resolve — the web bundle falls through to the native
// file (e.g. imageCrop.ts -> react-native-image-crop-picker) and crashes on load
// with `TurboModuleRegistry.getEnforcing`. Registering 'web' makes `.web.*` win.
config.resolver.platforms = [...config.resolver.platforms, 'web'];

module.exports = withNativeWind(config, { input: './global.css' });
