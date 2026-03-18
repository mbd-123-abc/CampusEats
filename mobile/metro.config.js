const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Reduce file watchers to avoid EMFILE on macOS
config.watchFolders = [];
config.resolver.blockList = [/node_modules\/.*\/node_modules\/.*/];
config.watcher = {
  ...config.watcher,
  watchman: {
    deferStates: ['hg.update'],
  },
};

module.exports = config;
