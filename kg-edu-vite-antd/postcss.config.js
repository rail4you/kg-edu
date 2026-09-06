export default {
  plugins: {
    autoprefixer: {
      // browserslist 统一在 package.json 中声明，这里仅确保 chrome95 的前缀补齐（如 backdrop-filter）
      overrideBrowserslist: ["chrome >= 95", "edge >= 95", "firefox >= 95", "safari >= 14", "ios >= 14"],
    },
  },
};
