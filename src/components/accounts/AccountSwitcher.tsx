/**
 * Account Switcher Component
 * Dropdown for switching between API accounts
 */

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Plus, User, Briefcase, Code, FlaskConical, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAccountStore } from './useAccounts';
import { Account, PROVIDER_INFO } from './types';

interface AccountSwitcherProps {
  onManageClick?: () => void;
  compact?: boolean;
  className?: string;
}

const getProfileIcon = (profileType?: string) => {
  switch (profileType) {
    case 'personal':
      return User;
    case 'work':
      return Briefcase;
    case 'development':
      return Code;
    case 'testing':
      return FlaskConical;
    default:
      return Settings;
  }
};

const getProviderColor = (provider: string): string => {
  return PROVIDER_INFO[provider as keyof typeof PROVIDER_INFO]?.color || '#6B7280';
};

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  onManageClick,
  compact = false,
  className
}) => {
  const {
    accounts,
    activeAccountId,
    isLoading,
    loadAccounts,
    setActiveAccount,
    getActiveAccount
  } = useAccountStore();

  const [isOpen, setIsOpen] = useState(false);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const activeAccount = getActiveAccount();

  const handleSelectAccount = async (account: Account) => {
    if (account.id !== activeAccountId) {
      await setActiveAccount(account.id);
    }
    setIsOpen(false);
  };

  const renderAccountItem = (account: Account) => {
    const ProfileIcon = getProfileIcon(account.profile?.type);
    const isActive = account.id === activeAccountId;
    const providerInfo = PROVIDER_INFO[account.provider];

    return (
      <DropdownMenuItem
        key={account.id}
        onClick={() => handleSelectAccount(account)}
        className={cn(
          'flex items-center gap-3 py-2 cursor-pointer',
          isActive && 'bg-accent'
        )}
      >
        {/* Provider indicator */}
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: getProviderColor(account.provider) }}
        />

        {/* Account info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{account.name}</span>
            {account.profile && (
              <ProfileIcon className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {providerInfo?.name || account.provider}
          </div>
        </div>

        {/* Active indicator */}
        {isActive && (
          <Check className="h-4 w-4 text-dragon-primary" />
        )}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={cn(
            'flex items-center gap-2',
            !activeAccount && 'text-muted-foreground',
            className
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          ) : activeAccount ? (
            <>
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getProviderColor(activeAccount.provider) }}
              />
              <span className={compact ? 'hidden sm:inline' : ''}>
                {activeAccount.name}
              </span>
            </>
          ) : (
            <>
              <User className="h-4 w-4" />
              <span className={compact ? 'hidden sm:inline' : ''}>
                No Account
              </span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>API Accounts</span>
          <span className="text-xs text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Account list */}
        {accounts.length > 0 ? (
          <>
            {accounts.map(renderAccountItem)}
          </>
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No accounts configured
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Manage accounts */}
        <DropdownMenuItem
          onClick={onManageClick}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Manage Accounts</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AccountSwitcher;
