"""
Package initialization module for the Provocative Cloud backend API.
Exports the FastAPI application instance and version information.
Serves as the main entry point for the API package.
"""

from api.app import create_application
from api.config import settings

# Export version and project information
__version__ = settings.API_VERSION
__project__ = settings.PROJECT_NAME

# Create and export the main FastAPI application instance
application = create_application()

# Make key components available for import
__all__ = [
    '__version__',
    '__project__',
    'application'
]