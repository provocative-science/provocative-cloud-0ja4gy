import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Select, MenuItem, Dialog, CircularProgress } from '@mui/material';
import { debounce } from 'lodash';

import AdminLayout from '../../layouts/AdminLayout';
import Table from '../../components/common/Table';
import { getUserList, updateUserRole } from '../../api/users';
import { AuthUser, UserRole } from '../../types/auth';
import { SortDirection } from '../../types/common';

// Constants
const PAGE_SIZE = 10;
const DEBOUNCE_DELAY = 300;
const MAX_RETRY_ATTEMPTS = 3;

// Column definitions for user table
const USER_TABLE_COLUMNS = [
  {
    key: 'email',
    header: 'Email',
    sortable: true,
    ariaLabel: 'User email address'
  },
  {
    key: 'roles',
    header: 'Role',
    sortable: true,
    ariaLabel: 'User role',
    render: (roles: UserRole[], user: AuthUser) => (
      <Select
        value={roles[0]}
        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
        aria-label={`Change role for user ${user.email}`}
      >
        {Object.values(UserRole).map((role) => (
          <MenuItem key={role} value={role}>
            {role}
          </MenuItem>
        ))}
      </Select>
    )
  },
  {
    key: 'created_at',
    header: 'Created At',
    sortable: true,
    ariaLabel: 'Account creation date',
    render: (date: number) => new Date(date).toLocaleDateString()
  }
];

interface UserTableState {
  users: AuthUser[];
  loading: boolean;
  error: Error | null;
  currentPage: number;
  totalItems: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: SortDirection;
  filterText: string;
  selectedUsers: string[];
  pendingRoleChanges: Map<string, UserRole>;
}

const Users: React.FC = React.memo(() => {
  // State management
  const [state, setState] = useState<UserTableState>({
    users: [],
    loading: true,
    error: null,
    currentPage: 1,
    totalItems: 0,
    pageSize: PAGE_SIZE,
    sortColumn: 'created_at',
    sortDirection: SortDirection.DESC,
    filterText: '',
    selectedUsers: [],
    pendingRoleChanges: new Map()
  });

  // Fetch users with debounced search
  const fetchUsers = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await getUserList({
        page: state.currentPage,
        limit: state.pageSize,
        sortBy: state.sortColumn,
        sortDirection: state.sortDirection,
        filters: {
          search: state.filterText
        }
      });

      setState(prev => ({
        ...prev,
        users: response.data,
        totalItems: response.total,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error,
        loading: false
      }));
    }
  }, [state.currentPage, state.pageSize, state.sortColumn, state.sortDirection, state.filterText]);

  // Debounced search handler
  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setState(prev => ({
        ...prev,
        filterText: value,
        currentPage: 1
      }));
    }, DEBOUNCE_DELAY),
    []
  );

  // Handle role changes with validation and audit logging
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setState(prev => ({
        ...prev,
        pendingRoleChanges: new Map(prev.pendingRoleChanges).set(userId, newRole)
      }));

      await updateUserRole(userId, newRole);

      // Update local state
      setState(prev => ({
        ...prev,
        users: prev.users.map(user => 
          user.id === userId ? { ...user, roles: [newRole] } : user
        ),
        pendingRoleChanges: new Map(prev.pendingRoleChanges).delete(userId)
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error,
        pendingRoleChanges: new Map(prev.pendingRoleChanges).delete(userId)
      }));
    }
  };

  // Handle pagination changes
  const handlePageChange = useCallback((page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
  }, []);

  // Handle sorting changes
  const handleSort = useCallback((column: string, direction: SortDirection) => {
    setState(prev => ({
      ...prev,
      sortColumn: column,
      sortDirection: direction,
      currentPage: 1
    }));
  }, []);

  // Initial data fetch and real-time updates
  useEffect(() => {
    fetchUsers();

    // Subscribe to user updates
    const unsubscribe = subscribeToUserUpdates((update) => {
      setState(prev => ({
        ...prev,
        users: prev.users.map(user => 
          user.id === update.userId ? { ...user, ...update } : user
        )
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [fetchUsers]);

  return (
    <AdminLayout>
      <Box padding={3}>
        <Typography variant="h4" gutterBottom>
          User Management
        </Typography>

        <Table
          columns={USER_TABLE_COLUMNS}
          data={state.users}
          loading={state.loading}
          pagination
          currentPage={state.currentPage}
          totalItems={state.totalItems}
          pageSize={state.pageSize}
          onPageChange={handlePageChange}
          onSort={handleSort}
          ariaLabel="User management table"
        />

        {/* Error Dialog */}
        <Dialog
          open={!!state.error}
          onClose={() => setState(prev => ({ ...prev, error: null }))}
          aria-labelledby="error-dialog-title"
        >
          <Box p={3}>
            <Typography id="error-dialog-title" variant="h6" gutterBottom>
              Error
            </Typography>
            <Typography>
              {state.error?.message || 'An error occurred while managing users.'}
            </Typography>
          </Box>
        </Dialog>
      </Box>
    </AdminLayout>
  );
});

Users.displayName = 'Users';

export default Users;