// Monorepo (packages/shared): SDK 52+ dan expo/metro-config ish maydonlarini o'zi topadi — qo'lda
// watchFolders / nodeModulesPaths berish shart emas (expo-doctor ham buni tavsiya qiladi).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
