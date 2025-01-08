# Provocative Cloud Web Frontend

Enterprise-grade GPU rental platform with integrated environmental impact monitoring and carbon capture visualization.

## Overview

Provocative Cloud's web frontend provides a sophisticated interface for GPU resource management while highlighting our commitment to environmental sustainability. The application offers real-time GPU metrics visualization, carbon capture monitoring, and an intuitive rental management system.

### Key Features
- Real-time GPU monitoring and metrics visualization
- Environmental impact dashboard with carbon capture metrics
- Responsive Material-UI based interface
- WebSocket-powered live updates
- Comprehensive accessibility support
- Multi-language support

## Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- VSCode (recommended)

### Recommended VSCode Extensions
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Material Icon Theme
- Jest Runner

## Getting Started

1. Clone the repository
```bash
git clone git@github.com:provocative-cloud/web.git
cd web
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Configure the following variables:
- `VITE_API_ENDPOINT`: Backend API endpoint
- `VITE_WEBSOCKET_URL`: GPU metrics WebSocket endpoint
- `VITE_CARBON_API_KEY`: Carbon capture API credentials

4. Start development server
```bash
npm run dev
```

## Project Structure

```
src/
├── api/                 # API and WebSocket integration
├── components/
│   ├── gpu/            # GPU monitoring components
│   ├── environmental/  # Carbon capture metrics
│   └── common/         # Shared components
├── hooks/
│   ├── useGPUMetrics/  # Real-time GPU data
│   └── useEnvironmental/ # Carbon capture metrics
├── pages/              # Application routes
├── store/              # Redux state management
├── styles/             # Theming and layouts
└── utils/              # Helper functions
```

## Development Guidelines

### Technology Stack
- React 18.2.0
- TypeScript 5.0.0
- Material-UI 5.14.0
- Redux Toolkit 1.9.5
- Socket.io Client 4.7.0
- Chart.js 4.3.0
- D3.js 7.8.5

### Code Style
- Follow TypeScript strict mode guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Maintain comprehensive prop types
- Document complex logic with JSDoc

### State Management
- Use Redux Toolkit for global state
- Implement React Query for API caching
- Utilize local state for component-specific data
- Handle WebSocket connections through custom hooks

### Performance Optimization
- Implement React.memo for expensive renders
- Use virtualization for long lists
- Optimize bundle size with code splitting
- Cache GPU metrics data appropriately
- Implement progressive loading for metrics charts

## GPU Monitoring Integration

### WebSocket Connection
```typescript
const useGPUMetrics = (gpuId: string) => {
  // Implementation in hooks/useGPUMetrics
};
```

### Metrics Visualization
- Real-time temperature monitoring
- VRAM usage tracking
- Power consumption metrics
- Utilization percentages
- Error rate monitoring

## Environmental Impact Features

### Carbon Capture Metrics
- CO2 capture rate visualization
- Power Usage Effectiveness (PUE) tracking
- Water Usage Effectiveness (WUE) monitoring
- Environmental impact dashboard
- Historical data analysis

## Testing Requirements

### Unit Testing
```bash
npm run test
```
- Jest and React Testing Library
- >80% code coverage requirement
- Mock WebSocket connections
- Simulate GPU metrics streams
- Test environmental calculations

### Integration Testing
```bash
npm run test:integration
```
- End-to-end user flows
- WebSocket reconnection handling
- API error scenarios
- Performance benchmarks

## Accessibility

- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader optimization
- High contrast theme support
- Responsive font sizing

## Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Production build
- `npm run test`: Run unit tests
- `npm run test:integration`: Run integration tests
- `npm run lint`: ESLint check
- `npm run lint:fix`: Auto-fix linting issues
- `npm run format`: Prettier formatting
- `npm run analyze`: Bundle size analysis

## Deployment Process

### Build Optimization
```bash
npm run build
```
- Generates optimized production build
- Implements code splitting
- Optimizes asset loading
- Generates source maps

### Environment Configurations
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

### Monitoring Integration
- Error tracking with Sentry
- Performance monitoring
- User analytics
- Environmental metrics logging

## Contributing

1. Follow the branching strategy:
   - `feature/*`: New features
   - `fix/*`: Bug fixes
   - `chore/*`: Maintenance tasks

2. Ensure all tests pass:
```bash
npm run test:all
```

3. Submit pull requests with:
   - Comprehensive description
   - Test coverage
   - Documentation updates
   - Performance impact analysis

## License

Copyright © 2023 Provocative Cloud. All rights reserved.