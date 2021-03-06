const base = require('../../jest.config.base.cjs');
const packageJson = require('./package.json');

const packageName = packageJson.name;

module.exports = {
  ...base,
  name: packageName,
  displayName: packageName,
  coveragePathIgnorePatterns: [
    ...base.coveragePathIgnorePatterns,
    '<rootDir>/src/filter/antlr'
  ]
};
