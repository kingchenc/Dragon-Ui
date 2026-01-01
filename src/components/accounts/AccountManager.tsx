/**
 * Account Manager Component
 * Full account management UI with add/edit/delete functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Key,
  Upload,
  Download,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAccountStore } from './useAccounts';
import { Account, AccountProvider, PROVIDER_INFO, PROFILE_PRESETS } from './types';

interface AccountManagerProps {
  onClose?: () => void;
}

const AccountManager: React.FC<AccountManagerProps> = ({ onClose }) => {
  const {
    accounts,
    isLoading,
    error,
    loadAccounts,
    addAccount,
    updateAccount,
    removeAccount,
    setActiveAccount,
    getApiKey,
    updateApiKey,
    exportAccounts,
    importAccounts,
    clearError
  } = useAccountStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<Account | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<Account | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState<AccountProvider>('anthropic');
  const [formApiKey, setFormApiKey] = useState('');
  const [formProfile, setFormProfile] = useState<string>('personal');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormName('');
    setFormProvider('anthropic');
    setFormApiKey('');
    setFormProfile('personal');
    setShowApiKey(false);
    setIsSubmitting(false);
  }, []);

  // Handle add account
  const handleAddAccount = useCallback(async () => {
    if (!formName.trim() || !formApiKey.trim()) {
      return;
    }

    setIsSubmitting(true);
    const profile = PROFILE_PRESETS[formProfile];

    const result = await addAccount(
      formName.trim(),
      formProvider,
      formApiKey.trim(),
      profile
    );

    setIsSubmitting(false);

    if (result) {
      setShowAddDialog(false);
      resetForm();
    }
  }, [formName, formProvider, formApiKey, formProfile, addAccount, resetForm]);

  // Handle update account
  const handleUpdateAccount = useCallback(async () => {
    if (!editingAccount || !formName.trim()) {
      return;
    }

    setIsSubmitting(true);
    const profile = PROFILE_PRESETS[formProfile];

    const success = await updateAccount(editingAccount.id, {
      name: formName.trim(),
      profile
    });

    setIsSubmitting(false);

    if (success) {
      setEditingAccount(null);
      resetForm();
    }
  }, [editingAccount, formName, formProfile, updateAccount, resetForm]);

  // Handle delete account
  const handleDeleteAccount = useCallback(async () => {
    if (!showDeleteDialog) return;

    setIsSubmitting(true);
    const success = await removeAccount(showDeleteDialog.id);
    setIsSubmitting(false);

    if (success) {
      setShowDeleteDialog(null);
    }
  }, [showDeleteDialog, removeAccount]);

  // Handle export
  const handleExport = useCallback(async () => {
    const data = await exportAccounts();
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dragon-ui-accounts.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [exportAccounts]);

  // Open edit dialog
  const openEditDialog = useCallback((account: Account) => {
    setEditingAccount(account);
    setFormName(account.name);
    setFormProvider(account.provider);
    setFormProfile(account.profile?.type || 'personal');
    setFormApiKey('');
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Manage your API accounts for different providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={accounts.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="bg-dragon-primary hover:bg-dragon-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={clearError}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Account list */}
      <div className="space-y-3">
        {accounts.length > 0 ? (
          accounts.map((account) => (
            <Card key={account.id} className={cn(
              'transition-colors',
              account.isActive && 'border-dragon-primary'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Provider indicator */}
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PROVIDER_INFO[account.provider]?.color }}
                    />

                    {/* Account info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.name}</span>
                        {account.isActive && (
                          <span className="px-1.5 py-0.5 text-xs bg-dragon-primary/20 text-dragon-primary rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {PROVIDER_INFO[account.provider]?.name}
                        {account.profile && ` • ${account.profile.type}`}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!account.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveAccount(account.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKeyDialog(account)}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(account)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteDialog(account)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No accounts configured</p>
              <p className="text-sm">Add an account to get started</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Add a new API account for a provider
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                placeholder="My Anthropic Account"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={formProvider} onValueChange={(v) => setFormProvider(v as AccountProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                        {info.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your API key is encrypted and stored securely
              </p>
            </div>

            <div className="space-y-2">
              <Label>Profile</Label>
              <Select value={formProfile} onValueChange={setFormProfile}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROFILE_PRESETS).map(([key, profile]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: profile.color }} />
                        {profile.type}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddAccount}
              disabled={!formName.trim() || !formApiKey.trim() || isSubmitting}
              className="bg-dragon-primary hover:bg-dragon-primary/90"
            >
              {isSubmitting ? 'Adding...' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Profile</Label>
              <Select value={formProfile} onValueChange={setFormProfile}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROFILE_PRESETS).map(([key, profile]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: profile.color }} />
                        {profile.type}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingAccount(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAccount}
              disabled={!formName.trim() || isSubmitting}
              className="bg-dragon-primary hover:bg-dragon-primary/90"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{showDeleteDialog?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <ApiKeyDialog
        account={showApiKeyDialog}
        onClose={() => setShowApiKeyDialog(null)}
        getApiKey={getApiKey}
        updateApiKey={updateApiKey}
      />
    </div>
  );
};

// Separate component for API Key dialog to handle async state
const ApiKeyDialog: React.FC<{
  account: Account | null;
  onClose: () => void;
  getApiKey: (id: string) => Promise<{ apiKey: string; masked: string } | null>;
  updateApiKey: (id: string, newKey: string) => Promise<boolean>;
}> = ({ account, onClose, getApiKey, updateApiKey }) => {
  const [currentKey, setCurrentKey] = useState<string>('');
  const [newKey, setNewKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load API key when dialog opens
  useEffect(() => {
    if (account) {
      setIsLoading(true);
      setError(null);
      getApiKey(account.id)
        .then((result) => {
          if (result) {
            setCurrentKey(result.apiKey);
          } else {
            setError('Failed to load API key');
          }
        })
        .catch(() => setError('Failed to load API key'))
        .finally(() => setIsLoading(false));
    } else {
      setCurrentKey('');
      setNewKey('');
      setShowKey(false);
      setError(null);
    }
  }, [account, getApiKey]);

  const handleUpdateKey = async () => {
    if (!account || !newKey.trim()) return;

    setIsSaving(true);
    setError(null);

    const success = await updateApiKey(account.id, newKey.trim());

    if (success) {
      setCurrentKey(newKey.trim());
      setNewKey('');
      onClose();
    } else {
      setError('Failed to update API key');
    }

    setIsSaving(false);
  };

  const getMaskedKey = (key: string) => {
    if (key.length <= 8) return '***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  return (
    <Dialog open={!!account} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Key - {account?.name}</DialogTitle>
          <DialogDescription>
            View or update the API key for this account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Current API Key */}
          <div className="space-y-2">
            <Label>Current API Key</Label>
            {isLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : (
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={showKey ? currentKey : getMaskedKey(currentKey)}
                  readOnly
                  className="pr-10 bg-muted"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>

          {/* New API Key */}
          <div className="space-y-2">
            <Label>New API Key (optional)</Label>
            <div className="relative">
              <Input
                type="password"
                placeholder="Enter new API key to update..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="pr-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to keep the current API key
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {newKey.trim() && (
            <Button
              onClick={handleUpdateKey}
              disabled={isSaving}
              className="bg-dragon-primary hover:bg-dragon-primary/90"
            >
              {isSaving ? 'Updating...' : 'Update API Key'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountManager;
