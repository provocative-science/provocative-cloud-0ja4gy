/**
 * API module for user-related operations in the Provocative Cloud frontend.
 * Handles user profile management, settings, administrative user operations,
 * and real-time user status updates.
 * @version 1.0.0
 */

import { get, put, handleError } from '../utils/api';
import { API_ENDPOINTS } from '../config/api';
import { ApiResponse, PaginatedResponse, PaginationParams } from '../types/common';
import { AuthUser, UserRole, UserStatus } from '../types/auth';

/**
 * Interface for user profile update data
 */
interface ProfileUpdateData {
  email?: string;
  ssh_keys?: string[];
  preferences?: {
    notifications?: boolean;
    theme?: 'light' | 'dark';
    timezone?: string;
  };
}

/**
 * Interface for user list filtering options
 */
interface UserListFilters {
  roles?: UserRole[];
  status?: UserStatus[];
  search?: string;
  dateRange?: {
    start: number;
    end: number;
  };
}

/**
 * Cache configuration for user data
 */
const CACHE_CONFIG = {
  TTL_MS: 5 * 60 * 1000, // 5 minutes
  USER_PREFIX: 'user_cache_'
};

/**
 * Retrieves the current authenticated user's profile with enhanced error handling
 * @returns Promise resolving to current user's profile data
 */
export async function getCurrentUser(): Promise<ApiResponse<AuthUser>> {
  try {
    const cacheKey = `${CACHE_CONFIG.USER_PREFIX}current`;
    const cachedData = sessionStorage.getItem(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const response = await get<AuthUser>(`${API_ENDPOINTS.USERS}/me`);
    
    // Cache the response
    sessionStorage.setItem(cacheKey, JSON.stringify(response));
    
    return response;
  } catch (error) {
    throw handleError(error);
  }
}

/**
 * Updates the current user's profile information with validation
 * @param profileData Profile data to update
 * @returns Promise resolving to updated user profile
 */
export async function updateUserProfile(
  profileData: ProfileUpdateData
): Promise<ApiResponse<AuthUser>> {
  try {
    // Validate SSH keys format if provided
    if (profileData.ssh_keys) {
      const sshKeyRegex = /^(ssh-rsa|ssh-ed25519)\s+[A-Za-z0-9+/]+[=]{0,3}\s+.+$/;
      if (!profileData.ssh_keys.every(key => sshKeyRegex.test(key))) {
        throw new Error('Invalid SSH key format');
      }
    }

    const response = await put<AuthUser>(
      `${API_ENDPOINTS.USERS}/me`,
      profileData
    );

    // Clear user cache
    sessionStorage.removeItem(`${CACHE_CONFIG.USER_PREFIX}current`);

    // Emit profile update event
    window.dispatchEvent(
      new CustomEvent('userProfileUpdate', { detail: response.data })
    );

    return response;
  } catch (error) {
    throw handleError(error);
  }
}

/**
 * Retrieves a paginated list of users with filtering (admin only)
 * @param params Pagination parameters
 * @param filters User list filters
 * @returns Promise resolving to paginated user list
 */
export async function getUserList(
  params: PaginationParams,
  filters?: UserListFilters
): Promise<PaginatedResponse<AuthUser>> {
  try {
    const queryParams = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
      sortBy: params.sortBy,
      sortDirection: params.sortDirection
    });

    if (filters) {
      if (filters.roles) {
        queryParams.append('roles', filters.roles.join(','));
      }
      if (filters.status) {
        queryParams.append('status', filters.status.join(','));
      }
      if (filters.search) {
        queryParams.append('search', filters.search);
      }
      if (filters.dateRange) {
        queryParams.append('startDate', filters.dateRange.start.toString());
        queryParams.append('endDate', filters.dateRange.end.toString());
      }
    }

    const response = await get<PaginatedResponse<AuthUser>>(
      `${API_ENDPOINTS.USERS}?${queryParams.toString()}`
    );

    return response;
  } catch (error) {
    throw handleError(error);
  }
}

/**
 * Retrieves a specific user by ID with role validation (admin only)
 * @param userId UUID of the user to retrieve
 * @returns Promise resolving to user profile data
 */
export async function getUserById(userId: string): Promise<ApiResponse<AuthUser>> {
  try {
    const cacheKey = `${CACHE_CONFIG.USER_PREFIX}${userId}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const response = await get<AuthUser>(`${API_ENDPOINTS.USERS}/${userId}`);

    // Cache the response
    sessionStorage.setItem(cacheKey, JSON.stringify(response));

    return response;
  } catch (error) {
    throw handleError(error);
  }
}

/**
 * Updates a user's role with permission validation (admin only)
 * @param userId UUID of the user to update
 * @param role New role to assign
 * @returns Promise resolving to updated user data
 */
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<ApiResponse<AuthUser>> {
  try {
    // Validate role transition
    const currentUser = await getCurrentUser();
    if (!currentUser.data.roles.includes(UserRole.ADMIN)) {
      throw new Error('Insufficient permissions to update user roles');
    }

    const response = await put<AuthUser>(
      `${API_ENDPOINTS.USERS}/${userId}/role`,
      { role }
    );

    // Clear user cache
    sessionStorage.removeItem(`${CACHE_CONFIG.USER_PREFIX}${userId}`);

    // Emit role update event
    window.dispatchEvent(
      new CustomEvent('userRoleUpdate', {
        detail: {
          userId,
          newRole: role,
          timestamp: Date.now()
        }
      })
    );

    return response;
  } catch (error) {
    throw handleError(error);
  }
}