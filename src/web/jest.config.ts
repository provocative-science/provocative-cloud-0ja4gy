import type { JestConfigWithTsJest } from 'ts-jest';

// Jest configuration for Provocative Cloud frontend testing
// Version: ts-jest@29.1.0
const config: JestConfigWithTsJest = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Use jsdom for browser environment simulation
  testEnvironment: 'jsdom',

  // Define test file locations
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Module path aliases mapping to match tsconfig and vite config
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setupTests.ts'
  ],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
    '!src/App.tsx'
  ],

  // Coverage thresholds enforcement
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript file transformation
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  },

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Verbose output for detailed test results
  verbose: true
};

export default config;