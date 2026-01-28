import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Trash2,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { PaperWithStats, PaperAvatar, AiAgentHistory, PaperAvatarStyle } from "../../../shared/types";

interface PaperAvatarSectionProps {
  paperId: string;
  paper: PaperWithStats;
  activeSession: AiAgentHistory | null;
  isUploader: boolean;
  currentUserId?: string;
  onAvatarChange?: () => void;
}

const STYLE_OPTIONS: { value: PaperAvatarStyle; label: string; description: string }[] = [
  {
    value: "diagram",
    label: "Diagram",
    description: "Clean flowchart/architecture style with labeled boxes and arrows",
  },
  {
    value: "infographic",
    label: "Infographic",
    description: "Modern data visualization style with icons and color-coded sections",
  },
  {
    value: "conceptual",
    label: "Conceptual",
    description: "Abstract artistic visualization using visual metaphors",
  },
  {
    value: "technical",
    label: "Technical",
    description: "Detailed schematic with algorithmic/mathematical structure",
  },
];

export function PaperAvatarSection({
  paperId,
  paper,
  activeSession,
  isUploader,
  currentUserId,
  onAvatarChange,
}: PaperAvatarSectionProps) {
  const [avatars, setAvatars] = useState<PaperAvatar[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<PaperAvatarStyle>("diagram");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loadingAvatars, setLoadingAvatars] = useState(false);

  // Get the active avatar
  const activeAvatar = avatars.find((a) => a.isActive) || (avatars.length > 0 ? avatars[0] : null);

  // Check if user can generate (has active session with API key and sentence analysis)
  const canGenerate = !!activeSession?.apiKeySet;
  const hasAnalysis = activeSession && Object.keys(activeSession.sentenceAnalysis || {}).length > 0;

  // Load avatars on mount
  useEffect(() => {
    loadAvatars();
  }, [paperId]);

  const loadAvatars = async () => {
    try {
      setLoadingAvatars(true);
      const { avatars: loadedAvatars } = await api.getPaperAvatars(paperId);
      setAvatars(loadedAvatars);
    } catch (error) {
      console.error("Failed to load avatars:", error);
    } finally {
      setLoadingAvatars(false);
    }
  };

  const handleGenerate = async () => {
    if (!activeSession?.id) {
      toast.error("No active AI session");
      return;
    }

    if (!hasAnalysis) {
      toast.error("Please complete 'Let Agent Read' first for better avatar generation");
      return;
    }

    setIsGenerating(true);
    try {
      const { avatar } = await api.generatePaperAvatar(paperId, {
        sessionId: activeSession.id,
        style: selectedStyle,
        customPrompt: customPrompt || undefined,
      });

      setAvatars((prev) => [avatar, ...prev.map(a => ({ ...a, isActive: false }))]);
      setShowGenerateDialog(false);
      setCustomPrompt("");
      toast.success("Paper avatar generated successfully!");
      onAvatarChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate avatar");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleActivate = async (avatarId: string) => {
    try {
      await api.activatePaperAvatar(paperId, avatarId);
      setAvatars((prev) =>
        prev.map((a) => ({
          ...a,
          isActive: a.id === avatarId,
        }))
      );
      toast.success("Avatar activated");
      onAvatarChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to activate avatar");
    }
  };

  const handleDelete = async (avatarId: string) => {
    try {
      await api.deletePaperAvatar(paperId, avatarId);
      setAvatars((prev) => prev.filter((a) => a.id !== avatarId));
      toast.success("Avatar deleted");
      onAvatarChange?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete avatar");
    }
  };

  // Render the avatar display or placeholder
  const renderAvatarDisplay = () => {
    if (loadingAvatars) {
      return (
        <div className="flex items-center justify-center h-48 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      );
    }

    if (activeAvatar || paper.activeAvatarUrl) {
      const imageUrl = activeAvatar?.imageData || paper.activeAvatarUrl;
      return (
        <div className="relative group">
          <div className="rounded-xl overflow-hidden border-2 border-indigo-100 dark:border-indigo-900 shadow-sm">
            <img
              src={imageUrl}
              alt={`Visual representation of ${paper.title}`}
              className="w-full h-auto max-h-64 object-contain bg-white dark:bg-slate-900"
            />
          </div>
          <div className="absolute bottom-2 right-2 flex gap-2">
            <Badge variant="secondary" className="bg-white/90 dark:bg-slate-800/90">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Generated
            </Badge>
          </div>

          {/* Overlay with actions on hover */}
          {currentUserId && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                {canGenerate && hasAnalysis && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowGenerateDialog(true)}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regenerate
                  </Button>
                )}
                {isUploader && avatars.length > 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowManageDialog(true)}
                  >
                    Manage ({avatars.length})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Placeholder when no avatar
    return (
      <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-800/50">
        <ImageIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 mb-4">No paper avatar yet</p>
        {currentUserId && canGenerate && hasAnalysis && (
          <Button onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Paper Avatar
          </Button>
        )}
        {currentUserId && canGenerate && !hasAnalysis && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Complete "Let Agent Read" first to generate an avatar
          </p>
        )}
        {currentUserId && !canGenerate && (
          <p className="text-sm text-slate-400">
            Configure an AI session with API key to generate avatars
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6">
      {renderAvatarDisplay()}

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Paper Avatar</DialogTitle>
            <DialogDescription>
              Create an AI-generated visual representation of this paper's main idea using DALL-E 3.
            </DialogDescription>
          </DialogHeader>

          {/* Style Selection */}
          <div className="space-y-3">
            <Label>Style</Label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.value}
                  onClick={() => setSelectedStyle(style.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedStyle === style.value
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <p className="font-medium text-sm">{style.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {style.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <Label htmlFor="customPrompt">Custom guidance (optional)</Label>
            <Textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Focus on the transformer architecture, emphasize the attention mechanism..."
              rows={3}
            />
            <p className="text-xs text-slate-500">
              Add specific instructions to guide the AI in creating the visualization
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateDialog(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate (~$0.05)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Avatars Dialog (for uploader) */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Paper Avatars</DialogTitle>
            <DialogDescription>
              Choose which avatar to display or delete avatars you no longer need.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className={`relative rounded-lg border-2 overflow-hidden ${
                  avatar.isActive
                    ? "border-indigo-500"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <img
                  src={avatar.imageData}
                  alt="Paper avatar"
                  className="w-full h-32 object-cover"
                />
                <div className="p-2 bg-white dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {avatar.style}
                      </Badge>
                      {avatar.isActive && (
                        <Badge className="ml-1 text-xs bg-indigo-500">Active</Badge>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!avatar.isActive && (
                          <DropdownMenuItem onClick={() => handleActivate(avatar.id)}>
                            <Check className="w-4 h-4 mr-2" />
                            Set as Active
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(avatar.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    by {avatar.userName}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
