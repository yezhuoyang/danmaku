import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Link as LinkIcon, Upload, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "../lib/api";
import type { PaperWithStats } from "../../../shared/types";

interface AddPaperDialogProps {
  onPaperAdded?: (paper: PaperWithStats) => void;
}

export function AddPaperDialog({ onPaperAdded }: AddPaperDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [arxivUrl, setArxivUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [arxivMetadata, setArxivMetadata] = useState<api.ArxivMetadata | null>(null);

  // For local PDF
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localTitle, setLocalTitle] = useState("");
  const [localAuthors, setLocalAuthors] = useState("");

  // If not logged in, show login prompt instead
  if (!user) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Paper
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              Please log in to add papers to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Link href="/login">
              <Button className="w-full" onClick={() => setOpen(false)}>
                <LogIn className="h-4 w-4 mr-2" />
                Log In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                Create Account
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleArxivFetch = async () => {
    const arxivId = api.extractArxivId(arxivUrl);
    if (!arxivId) {
      toast.error("Invalid ArXiv URL or ID");
      return;
    }

    setIsLoading(true);
    try {
      const metadata = await api.fetchArxivMetadata(arxivId);
      setArxivMetadata(metadata);
      toast.success("Paper found!");
    } catch (error) {
      toast.error("Failed to fetch paper metadata");
    } finally {
      setIsLoading(false);
    }
  };

  const handleArxivAdd = async () => {
    if (!arxivMetadata) return;

    const arxivId = api.extractArxivId(arxivUrl);
    if (!arxivId) return;

    setIsLoading(true);
    try {
      const result = await api.addPaper({
        arxivId,
        title: arxivMetadata.title,
        authors: arxivMetadata.authors,
        abstract: arxivMetadata.abstract,
      });
      toast.success("Paper added!");
      setOpen(false);
      resetForm();
      onPaperAdded?.(result.paper);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add paper");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalAdd = async () => {
    if (!localFile || !localTitle) {
      toast.error("Please select a PDF and enter a title");
      return;
    }

    setIsLoading(true);
    try {
      const contentHash = await api.hashPdfFile(localFile);
      const authors = localAuthors.split(",").map(a => a.trim()).filter(Boolean);

      const result = await api.addPaper({
        contentHash,
        title: localTitle,
        authors,
      });
      toast.success("Paper added!");
      setOpen(false);
      resetForm();
      onPaperAdded?.(result.paper);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add paper");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setArxivUrl("");
    setArxivMetadata(null);
    setLocalFile(null);
    setLocalTitle("");
    setLocalAuthors("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Paper
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add a Paper</DialogTitle>
          <DialogDescription>
            Add a paper from ArXiv or upload a local PDF
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="arxiv" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="arxiv">
              <LinkIcon className="h-4 w-4 mr-2" />
              ArXiv
            </TabsTrigger>
            <TabsTrigger value="local">
              <Upload className="h-4 w-4 mr-2" />
              Local PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="arxiv" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="arxiv-url">ArXiv URL or ID</Label>
              <div className="flex gap-2">
                <Input
                  id="arxiv-url"
                  placeholder="https://arxiv.org/abs/1706.03762"
                  value={arxivUrl}
                  onChange={(e) => setArxivUrl(e.target.value)}
                />
                <Button onClick={handleArxivFetch} disabled={isLoading || !arxivUrl}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
            </div>

            {arxivMetadata && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <h4 className="font-medium">{arxivMetadata.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {arxivMetadata.authors.slice(0, 5).join(", ")}
                  {arxivMetadata.authors.length > 5 && " et al."}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {arxivMetadata.abstract}
                </p>
                <Button onClick={handleArxivAdd} disabled={isLoading} className="w-full mt-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add This Paper
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="local" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="local-pdf">PDF File</Label>
              <Input
                id="local-pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => setLocalFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                The PDF stays on your computer - we only store a hash for identification
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="local-title">Title</Label>
              <Input
                id="local-title"
                placeholder="Paper title"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="local-authors">Authors (comma-separated)</Label>
              <Input
                id="local-authors"
                placeholder="Author 1, Author 2"
                value={localAuthors}
                onChange={(e) => setLocalAuthors(e.target.value)}
              />
            </div>

            <Button onClick={handleLocalAdd} disabled={isLoading || !localFile || !localTitle} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Paper
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
