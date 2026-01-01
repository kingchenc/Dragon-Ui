/**
 * MCP Server Manager Component
 * Manages MCP server connections and displays available servers
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Server,
  Folder,
  GitBranch,
  Database,
  Globe,
  Code,
  Terminal as TerminalIcon,
  Search,
  Plus,
  Trash2,
  Edit2,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  Wrench,
  FileText,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useMcpStore } from './useMcp';
import { MCPServer, MCPServerIcon, BUILTIN_SERVER_INFO } from './types';

interface MCPServerManagerProps {
  onClose?: () => void;
}

// Get icon component for server
const getServerIcon = (icon: MCPServerIcon) => {
  switch (icon) {
    case 'folder': return Folder;
    case 'git-branch': return GitBranch;
    case 'database': return Database;
    case 'globe': return Globe;
    case 'code': return Code;
    case 'terminal': return TerminalIcon;
    case 'search': return Search;
    default: return Server;
  }
};

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'connecting': return 'bg-yellow-500 animate-pulse';
    case 'error': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
};

const MCPServerManager: React.FC<MCPServerManagerProps> = ({ onClose }) => {
  const {
    servers,
    allTools,
    allResources,
    allPrompts,
    isLoading,
    error,
    loadServers,
    addServer,
    updateServer,
    removeServer,
    connectServer,
    disconnectServer,
    setAutoConnect,
    clearError,
    initializeListeners,
    cleanupListeners
  } = useMcpStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<MCPServer | null>(null);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formCwd, setFormCwd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initializeListeners();
    loadServers();

    return () => {
      cleanupListeners();
    };
  }, [initializeListeners, loadServers, cleanupListeners]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormCommand('');
    setFormArgs('');
    setFormCwd('');
    setIsSubmitting(false);
  }, []);

  // Handle add server
  const handleAddServer = useCallback(async () => {
    if (!formName.trim() || !formCommand.trim()) return;

    setIsSubmitting(true);

    const result = await addServer({
      name: formName.trim(),
      description: formDescription.trim(),
      command: formCommand.trim(),
      args: formArgs.trim() ? formArgs.split(' ') : [],
      cwd: formCwd.trim() || undefined,
      icon: 'server'
    });

    setIsSubmitting(false);

    if (result) {
      setShowAddDialog(false);
      resetForm();
    }
  }, [formName, formDescription, formCommand, formArgs, formCwd, addServer, resetForm]);

  // Handle update server
  const handleUpdateServer = useCallback(async () => {
    if (!editingServer || !formName.trim() || !formCommand.trim()) return;

    setIsSubmitting(true);

    const success = await updateServer(editingServer.id, {
      name: formName.trim(),
      description: formDescription.trim(),
      command: formCommand.trim(),
      args: formArgs.trim() ? formArgs.split(' ') : [],
      cwd: formCwd.trim() || undefined
    });

    setIsSubmitting(false);

    if (success) {
      setEditingServer(null);
      resetForm();
    }
  }, [editingServer, formName, formDescription, formCommand, formArgs, formCwd, updateServer, resetForm]);

  // Handle delete server
  const handleDeleteServer = useCallback(async () => {
    if (!showDeleteDialog) return;

    setIsSubmitting(true);
    const success = await removeServer(showDeleteDialog.id);
    setIsSubmitting(false);

    if (success) {
      setShowDeleteDialog(null);
    }
  }, [showDeleteDialog, removeServer]);

  // Open edit dialog
  const openEditDialog = useCallback((server: MCPServer) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormDescription(server.description);
    setFormCommand(server.command);
    setFormArgs(server.args.join(' '));
    setFormCwd(server.cwd || '');
  }, []);

  // Toggle expanded state
  const toggleExpanded = useCallback((serverId: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  }, []);

  // Render server card
  const renderServerCard = (server: MCPServer) => {
    const Icon = getServerIcon(server.icon);
    const isExpanded = expandedServers.has(server.id);
    const isConnected = server.status === 'connected';
    const isConnecting = server.status === 'connecting';
    const builtinInfo = BUILTIN_SERVER_INFO[server.id];

    return (
      <Card key={server.id} className={cn(
        'transition-all',
        isConnected && 'border-green-500/50',
        server.status === 'error' && 'border-red-500/50'
      )}>
        <CardContent className="p-4">
          {/* Server header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Expand toggle */}
              <button
                onClick={() => toggleExpanded(server.id)}
                className="p-1 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {/* Status indicator */}
              <div className={cn('w-2 h-2 rounded-full', getStatusColor(server.status))} />

              {/* Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: builtinInfo?.color || '#6B7280' + '20' }}
              >
                <Icon className="h-4 w-4" style={{ color: builtinInfo?.color || '#6B7280' }} />
              </div>

              {/* Name and description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{server.name}</span>
                  {server.builtin && (
                    <span className="px-1.5 py-0.5 text-xs bg-dragon-primary/20 text-dragon-primary rounded">
                      Built-in
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {server.description}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Connect/Disconnect */}
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectServer(server.id)}
                  disabled={isConnecting}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => connectServer(server.id)}
                  disabled={isConnecting}
                  className="bg-dragon-primary hover:bg-dragon-primary/90"
                >
                  {isConnecting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Start'}
                </Button>
              )}

              {/* Edit (custom servers only) */}
              {!server.builtin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(server)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteDialog(server)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Error message */}
          {server.error && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{server.error}</span>
            </div>
          )}

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Capabilities summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Wrench className="h-4 w-4 text-blue-500" />
                  <div>
                    <div className="text-sm font-medium">{server.tools.length}</div>
                    <div className="text-xs text-muted-foreground">Tools</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <FileText className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="text-sm font-medium">{server.resources.length}</div>
                    <div className="text-xs text-muted-foreground">Resources</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  <div>
                    <div className="text-sm font-medium">{server.prompts.length}</div>
                    <div className="text-xs text-muted-foreground">Prompts</div>
                  </div>
                </div>
              </div>

              {/* Tools list */}
              {server.tools.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Available Tools
                  </h4>
                  <div className="grid gap-1">
                    {server.tools.map((tool) => (
                      <div key={tool.name} className="p-2 bg-muted/30 rounded text-sm">
                        <span className="font-mono">{tool.name}</span>
                        {tool.description && (
                          <span className="text-muted-foreground ml-2">- {tool.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Command info */}
              <div className="text-xs text-muted-foreground font-mono bg-muted/30 p-2 rounded">
                {server.command} {server.args.join(' ')}
              </div>

              {/* Auto-connect toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Auto-connect on startup</span>
                  <p className="text-xs text-muted-foreground">
                    Automatically connect when Dragon UI starts
                  </p>
                </div>
                <Switch
                  checked={server.autoConnect || false}
                  onCheckedChange={(checked) => setAutoConnect(server.id, checked)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Separate builtin and custom servers
  const builtinServers = servers.filter(s => s.builtin);
  const customServers = servers.filter(s => !s.builtin);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5 text-dragon-primary" />
            MCP Servers
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage Model Context Protocol server connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadServers()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="bg-dragon-primary hover:bg-dragon-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{servers.filter(s => s.status === 'connected').length}</div>
          <div className="text-sm text-muted-foreground">Connected</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-500">{allTools.length}</div>
          <div className="text-sm text-muted-foreground">Total Tools</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-500">{allResources.length}</div>
          <div className="text-sm text-muted-foreground">Total Resources</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-500">{allPrompts.length}</div>
          <div className="text-sm text-muted-foreground">Total Prompts</div>
        </Card>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Built-in servers */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Built-in Servers</h4>
        {builtinServers.map(renderServerCard)}
      </div>

      {/* Custom servers */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Custom Servers</h4>
        {customServers.length > 0 ? (
          customServers.map(renderServerCard)
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <p>No custom servers configured</p>
            <p className="text-sm">Add a custom MCP server to extend functionality</p>
          </Card>
        )}
      </div>

      {/* Add Server Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom MCP Server</DialogTitle>
            <DialogDescription>
              Add a new MCP server to extend Dragon UI capabilities
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Server Name</Label>
              <Input
                placeholder="My Custom Server"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="What does this server do?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Command</Label>
              <Input
                placeholder="npx, node, python, etc."
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Arguments</Label>
              <Input
                placeholder="-y @your/mcp-server"
                value={formArgs}
                onChange={(e) => setFormArgs(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Space-separated arguments for the command
              </p>
            </div>

            <div className="space-y-2">
              <Label>Working Directory (optional)</Label>
              <Input
                placeholder="/path/to/working/directory"
                value={formCwd}
                onChange={(e) => setFormCwd(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddServer}
              disabled={!formName.trim() || !formCommand.trim() || isSubmitting}
              className="bg-dragon-primary hover:bg-dragon-primary/90"
            >
              {isSubmitting ? 'Adding...' : 'Add Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Server Dialog */}
      <Dialog open={!!editingServer} onOpenChange={(open) => !open && setEditingServer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Server</DialogTitle>
            <DialogDescription>
              Update server configuration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Server Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Command</Label>
              <Input
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Arguments</Label>
              <Input
                value={formArgs}
                onChange={(e) => setFormArgs(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Working Directory (optional)</Label>
              <Input
                value={formCwd}
                onChange={(e) => setFormCwd(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingServer(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateServer}
              disabled={!formName.trim() || !formCommand.trim() || isSubmitting}
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
            <DialogTitle>Delete Server</DialogTitle>
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
              onClick={handleDeleteServer}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MCPServerManager;
