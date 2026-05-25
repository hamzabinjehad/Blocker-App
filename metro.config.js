const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = getDefaultConfig(__dirname);
const defaultBlockList = config.resolver.blockList;
const inheritedBlockList = Array.isArray(defaultBlockList)
  ? defaultBlockList
  : defaultBlockList
    ? [defaultBlockList]
    : [];

config.resolver.blockList = exclusionList([
  ...inheritedBlockList,
  /android[/\\].*[/\\]build[/\\].*/,
  /modules[/\\][^/\\]+[/\\]android[/\\]build[/\\].*/,
  /node_modules[/\\][^/\\]+[/\\]android[/\\]\.cxx[/\\].*/,
  /node_modules[/\\][^/\\]+[/\\]android[/\\]build[/\\].*/,
]);

module.exports = config;
