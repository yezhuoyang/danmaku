import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Globe, Lock, UserPlus, X, Loader2, GitFork, Users, Search } from "lucide-react";
import { toast } from "sonner";
import type { PaperWithStats, PaperCollaborator, PaperCollaboratorRole, PaperVisibility } from "../../../shared/types";
import * as api from "../lib/api";

interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  avatar?: string;
}

interface PaperSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: PaperWithStats;
  onPaperUpdated: (paper: PaperWithStats) => void;
}

export function PaperSettingsDialog({
  open,
  onOpenChange,
  paper,
  onPaperUpdated,
}: PaperSettingsDialogProps) {
  const [visibility, setVisibility] = useState<PaperVisibility>(paper.visibility);
  const [collaborators, setCollaborators] = useState<PaperCollaborator[]>([]);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [newCollaboratorUsername, setNewCollaboratorUsername] = useState("");
  const [newCollaboratorRole, setNewCollaboratorRole] = useState<PaperCollaboratorRole>("viewer");
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);

  // User search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load collaborators when dialog opens
  useEffect(() => {
    if (open) {
      loadCollaborators();
    }
  }, [open, paper.id]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await api.searchUsers(searchQuery.trim());
        // Filter out users who are already collaborators
        const existingUserIds = new Set(collaborators.map(c => c.userId));
        const filteredResults = result.users.filter((u: UserSearchResult) => !existingUserIds.has(u.id));
        setSearchResults(filteredResults);
        setShowDropdown(filteredResults.length > 0);
        setHasSearched(true);
      } catch (error) {
        console.error("Failed to search users:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, collaborators]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadCollaborators = async () => {
    setIsLoadingCollaborators(true);
    try {
      const result = await api.getPaperCollaborators(paper.id);
      setCollaborators(result.collaborators);
    } catch (error) {
      console.error("Failed to load collaborators:", error);
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  const handleVisibilityChange = async (isPrivate: boolean) => {
    const newVisibility: PaperVisibility = isPrivate ? 'private' : 'public';
    setIsUpdatingVisibility(true);
    try {
      await api.updatePaperVisibility(paper.id, newVisibility);
      setVisibility(newVisibility);
      onPaperUpdated({ ...paper, visibility: newVisibility });
      toast.success(`Paper is now ${newVisibility}`);
    } catch (error) {
      console.error("Failed to update visibility:", error);
      toast.error("Failed to update visibility");
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.displayName || user.username);
    setNewCollaboratorUsername(user.username);
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setNewCollaboratorUsername("");
    setHasSearched(false);
    searchInputRef.current?.focus();
  };

  const handleAddCollaborator = async () => {
    if (!newCollaboratorUsername.trim()) {
      toast.error("Please search and select a user");
      return;
    }

    setIsAddingCollaborator(true);
    try {
      const result = await api.addPaperCollaborator(
        paper.id,
        newCollaboratorUsername.trim(),
        newCollaboratorRole
      );
      setCollaborators([...collaborators, result.collaborator]);
      setNewCollaboratorUsername("");
      setSearchQuery("");
      setSelectedUser(null);
      setHasSearched(false);
      toast.success("Collaborator added");
    } catch (error: any) {
      console.error("Failed to add collaborator:", error);
      const message = error?.message || "Failed to add collaborator";
      toast.error(message);
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const handleUpdateRole = async (collaboratorId: string, role: PaperCollaboratorRole) => {
    try {
      await api.updatePaperCollaboratorRole(paper.id, collaboratorId, role);
      setCollaborators(collaborators.map(c =>
        c.id === collaboratorId ? { ...c, role } : c
      ));
      toast.success("Role updated");
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    try {
      await api.removePaperCollaborator(paper.id, collaboratorId);
      setCollaborators(collaborators.filter(c => c.id !== collaboratorId));
      toast.success("Collaborator removed");
    } catch (error) {
      console.error("Failed to remove collaborator:", error);
      toast.error("Failed to remove collaborator");
    }
  };

  const getRoleColor = (role: PaperCollaboratorRole) => {
    switch (role) {
      case 'editor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'commenter': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paper Settings</DialogTitle>
          <DialogDescription>
            Manage visibility and collaborators for this paper
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="visibility" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="visibility" className="flex items-center gap-2">
              {visibility === 'private' ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              Visibility
            </TabsTrigger>
            <TabsTrigger value="collaborators" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Collaborators
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visibility" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base">Private Paper</Label>
                <p className="text-sm text-muted-foreground">
                  {visibility === 'private'
                    ? "Only you and collaborators can see this paper"
                    : "Anyone can see this paper and its content"
                  }
                </p>
              </div>
              <Switch
                checked={visibility === 'private'}
                onCheckedChange={handleVisibilityChange}
                disabled={isUpdatingVisibility}
              />
            </div>

            {visibility === 'private' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <Lock className="h-4 w-4 inline mr-2" />
                  This paper is private. Add collaborators to share access.
                </p>
              </div>
            )}

            {paper.forkCount > 0 && (
              <div className="pt-2">
                <Separator className="mb-4" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitFork className="h-4 w-4" />
                  <span>This paper has been forked {paper.forkCount} time{paper.forkCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="collaborators" className="space-y-4 pt-4">
            {/* Add collaborator form */}
            <div className="space-y-3">
              <Label>Add Collaborator</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {selectedUser ? (
                    <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedUser.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {(selectedUser.displayName || selectedUser.username).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">
                        {selectedUser.displayName || selectedUser.username}
                        {selectedUser.displayName && (
                          <span className="text-muted-foreground ml-1">@{selectedUser.username}</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleClearSelection}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSelectedUser(null);
                            setNewCollaboratorUsername("");
                          }}
                          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && selectedUser) {
                              handleAddCollaborator();
                            }
                          }}
                          className="pl-9"
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {showDropdown && searchResults.length > 0 && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-50 w-full mt-1 py-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto"
                        >
                          {searchResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
                              onClick={() => handleSelectUser(user)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar || undefined} />
                                <AvatarFallback>
                                  {(user.displayName || user.username).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {user.displayName || user.username}
                                </p>
                                {user.displayName && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    @{user.username}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {hasSearched && !showDropdown && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                        <div className="absolute z-50 w-full mt-1 py-2 px-3 bg-popover border rounded-md shadow-lg text-sm text-muted-foreground">
                          No users found matching "{searchQuery}"
                        </div>
                      )}
                    </>
                  )}
                </div>
                <Select
                  value={newCollaboratorRole}
                  onValueChange={(v) => setNewCollaboratorRole(v as PaperCollaboratorRole)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="commenter">Commenter</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddCollaborator}
                  disabled={isAddingCollaborator || !selectedUser}
                  size="icon"
                >
                  {isAddingCollaborator ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>Viewer:</strong> Can read only &bull; <strong>Commenter:</strong> Can add comments &bull; <strong>Editor:</strong> Full access
              </p>
            </div>

            <Separator />

            {/* Collaborators list */}
            <div className="space-y-3">
              <Label>Current Collaborators</Label>
              {isLoadingCollaborators ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : collaborators.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No collaborators yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={collaborator.userAvatar} />
                          <AvatarFallback>
                            {collaborator.userName?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{collaborator.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            Added by {collaborator.invitedByName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={collaborator.role}
                          onValueChange={(v) => handleUpdateRole(collaborator.id, v as PaperCollaboratorRole)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="commenter">Commenter</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveCollaborator(collaborator.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
