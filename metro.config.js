const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// lucide-react-native's package.json "exports" map doesn't resolve cleanly
// under Metro's package-exports support (a known open issue upstream) —
// falls back to the classic main/browser fields instead, which do resolve.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
