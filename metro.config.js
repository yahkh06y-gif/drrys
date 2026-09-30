// Metro config: Expo defaults + one fix.
// pdf-lib (used to send only the session's pages to the AI) imports `tslib`; with package "exports"
// Metro picks tslib's ESM build, whose default export is undefined → "Cannot destructure '__extends'".
// Pointing `tslib` at its CommonJS file fixes it.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const tslibCjs = require.resolve('tslib/tslib.js');
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') return { type: 'sourceFile', filePath: tslibCjs };
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
