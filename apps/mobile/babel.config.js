module.exports = function (api) {
  api.cache(true);
  // Reanimated 4: worklets plagini (react-native-worklets/plugin) babel-preset-expo tomonidan o'zi qo'shiladi
  return { presets: ['babel-preset-expo'] };
};
