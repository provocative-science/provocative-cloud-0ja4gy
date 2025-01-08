import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.1
import path from 'path';
import compression from 'vite-plugin-compression'; // ^0.5.1
import imagemin from 'vite-plugin-imagemin'; // ^0.6.1
import { visualizer } from 'rollup-plugin-visualizer';

// Production-grade Vite configuration for Provocative Cloud frontend
export default defineConfig({
  plugins: [
    // React plugin with Fast Refresh enabled for development
    react({
      fastRefresh: true,
      // Enable additional React optimizations for production
      babel: {
        plugins: process.env.NODE_ENV === 'production' ? [
          ['transform-remove-console'],
          ['transform-react-remove-prop-types']
        ] : []
      }
    }),
    
    // Compression plugins for production builds
    compression({
      algorithm: 'brotli',
      ext: '.br',
      threshold: 10240, // Only compress files > 10KB
      deleteOriginFile: false
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240,
      deleteOriginFile: false
    }),
    
    // Image optimization for production
    imagemin({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false
      },
      optipng: {
        optimizationLevel: 7
      },
      mozjpeg: {
        quality: 80
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox'
          },
          {
            name: 'removeEmptyAttrs',
            active: false
          }
        ]
      }
    }),
    
    // Bundle size analyzer (generates stats in production)
    visualizer({
      filename: './dist/stats.html',
      open: process.env.NODE_ENV === 'production',
      gzipSize: true,
      brotliSize: true
    })
  ],

  // Path aliases for clean imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@store': path.resolve(__dirname, './src/store'),
      '@api': path.resolve(__dirname, './src/api'),
      '@types': path.resolve(__dirname, './src/types'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all local IPs
    https: true, // Enable HTTPS in development
    cors: true, // Enable CORS
    proxy: {
      // API proxy configuration
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      // WebSocket proxy for real-time updates
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        secure: false
      }
    },
    hmr: {
      overlay: true // Show errors as overlay
    }
  },

  // Production build configuration
  build: {
    target: [
      'chrome90',
      'firefox88',
      'safari14',
      'edge90',
      'ios14',
      'android8'
    ],
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    cssCodeSplit: true, // Enable CSS code splitting
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000, // 1MB warning limit
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            '@mui/material',
            '@reduxjs/toolkit',
            'chart.js'
          ],
          'gpu-utils': [
            '@utils/gpu',
            '@hooks/useGpu'
          ],
          'monitoring': [
            '@utils/monitoring',
            '@hooks/useMetrics'
          ]
        }
      }
    }
  },

  // Preview server configuration
  preview: {
    port: 3000,
    https: true,
    cors: true
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@reduxjs/toolkit',
      'chart.js'
    ],
    exclude: ['@types']
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts'
      ]
    }
  }
});