module.exports = {
  presets: [
    // Ensure your existing presets are here (e.g., @babel/preset-env, @babel/preset-react, @babel/preset-typescript)
    '@babel/preset-env',
    '@babel/preset-react', // Or whatever react preset you are using
    '@babel/preset-typescript', // If you are using TypeScript
  ],
  plugins: [
    // This is the line that should be present:
    '@babel/plugin-transform-optional-chaining',

    // Add any other Remix-specific plugins if you have them configured
  ],
};
