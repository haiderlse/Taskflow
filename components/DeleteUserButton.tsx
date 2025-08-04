/*
 * QA Analysis: Delete User Button and Functionality
 *
 * Functional:
 * - Happy Path: User clicks delete button, confirmation modal appears with clear messaging. 
 *   User confirms deletion, API call succeeds, user is removed from UI, success notification shown.
 * - Edge Case 1: API call fails - error message displayed, user remains in UI, no state changes.
 * - Edge Case 2: User cancels in confirmation modal - action aborted, no changes made.
 * - Edge Case 3: User attempts to delete themselves - prevented with clear error message.
 * - Edge Case 4: User lacks permission to delete - action disabled or error shown.
 * - State Management: User list updated atomically, loading states managed, no race conditions.
 *
 * UI/UX:
 * - Icon: Trash can icon is universally recognized for deletion. Clear visual indication.
 * - Layout: Button properly sized for touch targets (44px+), adequate spacing from other elements.
 * - Clarity: Confirmation dialog uses explicit language: "permanently delete [UserName]".
 *   Button labeled clearly as "Delete" with danger styling.
 *
 * Accessibility:
 * - Semantic HTML: Uses proper <button> elements, modal uses dialog role.
 * - ARIA: Proper aria-label, confirmation dialog properly announced to screen readers.
 * - Keyboard Navigation: Fully keyboard accessible, focus trapped in modal, escape key closes.
 * - Screen Reader: Clear announcements for all state changes and confirmations.
 *
 * Error Handling:
 * - User Feedback: Clear, actionable error messages. Success confirmations provided.
 * - Graceful Failure: Network failures handled gracefully, user data preserved.
 * - Loading States: Visual loading indicators during API calls, buttons disabled during processing.
 *
 * Performance:
 * - Efficiency: Minimal re-renders, efficient API calls, proper memoization.
 * - Resource Management: Event listeners cleaned up, no memory leaks from modals.
 */

import React, { useState, useCallback } from 'react';
import { User } from '../types';
import { TrashIcon } from './icons';
import { useToast } from '../utils/ux';
import { useConfirmation } from '../utils/ux';
import { AccessibleButton, ScreenReaderOnly } from '../utils/accessibility';
import { enhancedApi } from '../services/enhancedApi';

interface DeleteUserButtonProps {
  user: User;
  currentUser: User;
  onUserDeleted: (userId: string) => void;
  disabled?: boolean;
}

/**
 * QA-Compliant Delete User Button Component
 * 
 * Implements comprehensive accessibility, error handling, and user experience
 * following Senior QA Manager best practices.
 */
export const DeleteUserButton: React.FC<DeleteUserButtonProps> = ({
  user,
  currentUser,
  onUserDeleted,
  disabled = false
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { addToast } = useToast();
  const { confirm, ConfirmationComponent, setLoading } = useConfirmation();

  // Prevent users from deleting themselves
  const canDelete = currentUser.role === 'admin' && currentUser.uid !== user.uid && user.isActive;
  const isDisabled = disabled || !canDelete || isDeleting;

  const handleDeleteClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      // Show confirmation dialog with explicit messaging
      const confirmed = await confirm({
        title: 'Delete User Account',
        message: `Are you sure you want to permanently delete ${user.displayName}'s account? This action cannot be undone and will remove all their data from the system.`,
        confirmText: 'Delete User',
        cancelText: 'Cancel',
        variant: 'danger'
      });

      if (!confirmed) {
        return;
      }

      // Set loading state for confirmation dialog
      setLoading(true);
      setIsDeleting(true);

      // Simulate API call to delete user
      await enhancedApi.deleteUser(user.uid);

      // Success - update UI and show confirmation
      onUserDeleted(user.uid);
      addToast({
        type: 'success',
        title: 'User Deleted',
        message: `${user.displayName}'s account has been successfully deleted.`,
        duration: 5000
      });

    } catch (error) {
      // Error handling - show user-friendly message
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      addToast({
        type: 'error',
        title: 'Failed to Delete User',
        message: `Could not delete ${user.displayName}'s account. ${errorMessage}`,
        duration: 7000,
        action: {
          label: 'Retry',
          onClick: () => handleDeleteClick()
        }
      });

      console.error('Delete user failed:', error);
    } finally {
      setIsDeleting(false);
      setLoading(false);
    }
  }, [user, currentUser, confirm, addToast, onUserDeleted, isDisabled, setLoading]);

  // Generate appropriate tooltip/aria-label
  const getAccessibilityProps = () => {
    if (!canDelete) {
      if (currentUser.uid === user.uid) {
        return {
          'aria-label': 'Cannot delete your own account',
          title: 'You cannot delete your own account'
        };
      }
      if (currentUser.role !== 'admin') {
        return {
          'aria-label': 'Insufficient permissions to delete user',
          title: 'Admin permissions required to delete users'
        };
      }
      if (!user.isActive) {
        return {
          'aria-label': 'User account is already inactive',
          title: 'This user account is already inactive'
        };
      }
    }
    
    return {
      'aria-label': `Delete ${user.displayName}'s account`,
      title: `Delete ${user.displayName}'s account`
    };
  };

  const accessibilityProps = getAccessibilityProps();

  return (
    <>
      <AccessibleButton
        variant="danger"
        onClick={handleDeleteClick}
        disabled={isDisabled}
        loading={isDeleting}
        loadingText="Deleting..."
        className="inline-flex items-center px-3 py-1.5 text-sm"
        {...accessibilityProps}
      >
        <TrashIcon className="w-4 h-4 mr-1.5" aria-hidden="true" />
        <span className="hidden sm:inline">Delete</span>
        <ScreenReaderOnly>
          {isDeleting ? `Deleting ${user.displayName}'s account` : `Delete ${user.displayName}'s account`}
        </ScreenReaderOnly>
      </AccessibleButton>

      {/* Confirmation dialog component */}
      {ConfirmationComponent}
    </>
  );
};

/**
 * Hook for managing user deletion operations
 * Provides reusable deletion logic with proper error handling
 */
export function useUserDeletion() {
  const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  const deleteUser = useCallback(async (
    user: User,
    currentUser: User,
    onSuccess?: (userId: string) => void
  ): Promise<boolean> => {
    if (currentUser.uid === user.uid) {
      addToast({
        type: 'error',
        title: 'Cannot Delete Account',
        message: 'You cannot delete your own account. Please contact another administrator.',
        duration: 5000
      });
      return false;
    }

    if (currentUser.role !== 'admin') {
      addToast({
        type: 'error',
        title: 'Insufficient Permissions',
        message: 'Only administrators can delete user accounts.',
        duration: 5000
      });
      return false;
    }

    try {
      setDeletingUsers(prev => new Set(prev).add(user.uid));
      
      await enhancedApi.deleteUser(user.uid);
      
      onSuccess?.(user.uid);
      
      addToast({
        type: 'success',
        title: 'User Deleted',
        message: `${user.displayName}'s account has been successfully deleted.`,
        duration: 5000
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: `Could not delete ${user.displayName}'s account. ${errorMessage}`,
        duration: 7000
      });

      console.error('Delete user failed:', error);
      return false;
    } finally {
      setDeletingUsers(prev => {
        const next = new Set(prev);
        next.delete(user.uid);
        return next;
      });
    }
  }, [addToast]);

  const isDeleting = useCallback((userId: string) => {
    return deletingUsers.has(userId);
  }, [deletingUsers]);

  return {
    deleteUser,
    isDeleting,
    deletingUsers: Array.from(deletingUsers)
  };
}

/*
 * Test Cases for Delete User Functionality:
 * 
 * Happy Path:
 * 1. Admin clicks delete button -> confirmation appears -> confirms -> user deleted -> success toast shown
 * 
 * Edge Cases:
 * 2. Admin tries to delete themselves -> action prevented -> error message shown
 * 3. Non-admin tries to delete user -> button disabled or error shown
 * 4. API call fails -> error toast with retry option shown -> user remains in list
 * 5. User cancels confirmation dialog -> no action taken -> dialog closes
 * 6. User tries to delete inactive user -> action prevented -> appropriate message shown
 * 
 * Accessibility:
 * 7. Navigate to delete button with Tab -> focus visible -> accessible label announced
 * 8. Press Enter/Space on delete button -> confirmation dialog opens -> focus trapped
 * 9. Press Escape in confirmation dialog -> dialog closes -> focus returns to button
 * 10. Screen reader announces all state changes (loading, success, error)
 * 
 * Error Handling:
 * 11. Network timeout -> graceful error message -> user can retry
 * 12. Server error 500 -> user-friendly error message -> technical details logged
 * 13. Permission denied -> clear permission error message shown
 */

export default DeleteUserButton;