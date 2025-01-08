# Provocative Cloud 🌍⚡

[![Build Status](https://shields.io/github/workflow/status/provocative-cloud/main)](https://github.com/provocative-cloud/actions)
[![Test Coverage](https://shields.io/codecov/c/github/provocative-cloud)](https://codecov.io/gh/provocative-cloud)
[![License](https://shields.io/badge/license-MIT-blue)](LICENSE)
[![Carbon Capture](https://shields.io/badge/carbon%20capture-active-green)](https://docs.provocative.cloud/environmental-impact)

Provocative Cloud is a revolutionary GPU rental platform that combines high-performance computing with environmental responsibility. Our platform provides on-demand access to GPU resources while actively contributing to carbon capture through our innovative cooling system technology.

## 🌟 Features

- **GPU Rental**
  - On-demand access to NVIDIA A100, V100, and other high-performance GPUs
  - Flexible hourly pricing with auto-renewal options
  - Real-time resource monitoring and metrics
  - Multiple deployment options: SSH, Docker, Jupyter Notebooks

- **Environmental Impact**
  - Integrated CO2 capture from server cooling systems
  - Real-time environmental impact dashboard
  - Carbon capture metrics and reporting
  - Sustainable computing certifications

- **Platform Capabilities**
  - Automated billing and Stripe integration
  - Google OAuth authentication
  - Real-time performance monitoring
  - Comprehensive API access
  - Enterprise-grade security

## 🏗️ Architecture

Provocative Cloud is built on a modern, scalable architecture:

- **Frontend**: React 18.0+ with TypeScript 5.0+
- **Backend**: Python 3.10+ with FastAPI
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7.0+
- **GPU Support**: NVIDIA CUDA 12.0+
- **Infrastructure**: Docker 24.0+, Kubernetes 1.27+

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0+
- Python 3.10+
- Docker 24.0+
- NVIDIA GPU drivers
- AWS account (for production deployment)

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/provocative-cloud/provocative-cloud.git
cd provocative-cloud
```

2. Backend setup:
```bash
cd src/backend
poetry install
poetry run python -m pytest
poetry run uvicorn api.main:app --reload
```

3. Frontend setup:
```bash
cd src/web
yarn install
yarn test
yarn dev
```

4. Infrastructure setup:
```bash
docker-compose up -d
kubectl apply -f k8s/
```

## 💻 Development

For detailed development instructions, please refer to our [Contributing Guide](CONTRIBUTING.md).

### Environment Variables

Create a `.env` file with the following variables:
```
GOOGLE_OAUTH_CLIENT_ID=your_client_id
STRIPE_API_KEY=your_stripe_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

### Testing

```bash
# Backend tests
poetry run python -m pytest

# Frontend tests
yarn test

# E2E tests
yarn cypress run
```

## 📦 Deployment

Detailed deployment guides are available in our documentation:

- [AWS Deployment Guide](https://docs.provocative.cloud/deployment/aws)
- [Kubernetes Setup](https://docs.provocative.cloud/deployment/kubernetes)
- [Environmental Systems Configuration](https://docs.provocative.cloud/deployment/environmental)

## 📚 Documentation

- [API Documentation](https://docs.provocative.cloud/api)
- [User Guide](https://docs.provocative.cloud/user-guide)
- [Admin Guide](https://docs.provocative.cloud/admin-guide)
- [Environmental Impact Reports](https://docs.provocative.cloud/environmental)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 🔒 Security

For security concerns, please review our [Security Policy](SECURITY.md). Report vulnerabilities to security@provocative.cloud.

## 🌱 Environmental Impact

Track our real-time environmental impact and carbon capture metrics at [Environmental Dashboard](https://dashboard.provocative.cloud/environmental).

## 💪 Support

- Documentation: https://docs.provocative.cloud
- Issues: [GitHub Issues](https://github.com/provocative-cloud/issues)
- Security: security@provocative.cloud
- Environmental: sustainability@provocative.cloud
- Community: [Discord Server](https://discord.gg/provocative-cloud)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for a sustainable future in AI computing.