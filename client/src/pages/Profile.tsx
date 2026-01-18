import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User as UserIcon,
  Camera,
  Save,
  X,
  Lock,
  FileText,
  MessageSquare,
  MessageCircle,
  BookOpen,
  Bot,
  Plus,
  Trash2,
  ArrowLeft,
  Edit2,
  Users,
  UserPlus,
  UserMinus,
  Bookmark,
  Upload,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import type { UserWithStats, PaperCollection, UserSummary, PaperWithStats } from "../../../shared/types";
import type { UserStats } from "../lib/api";
import { toast } from "sonner";

// Common research interest suggestions
const SUGGESTED_INTERESTS = [
  "Machine Learning",
  "Deep Learning",
  "Natural Language Processing",
  "Computer Vision",
  "Reinforcement Learning",
  "Robotics",
  "Graph Neural Networks",
  "Transformers",
  "Generative AI",
  "LLMs",
  "Optimization",
  "Theoretical CS",
  "Distributed Systems",
  "Security",
  "HCI",
];

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const { user: currentUser, refreshUser } = useAuth();
  const userId = params?.userId;

  const [profile, setProfile] = useState<UserWithStats | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("collections");

  // Tab data
  const [collections, setCollections] = useState<PaperCollection[]>([]);
  const [uploads, setUploads] = useState<PaperWithStats[]>([]);
  const [following, setFollowing] = useState<UserSummary[]>([]);
  const [followers, setFollowers] = useState<UserSummary[]>([]);

  // Edit form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [researchInterests, setResearchInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>();

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (userId && profile) {
      loadTabData(activeTab);
    }
  }, [userId, activeTab, profile]);

  async function loadProfile() {
    setLoading(true);
    try {
      const userData = await api.getUserProfileWithStats(userId!);
      setProfile(userData);
      setDisplayName(userData.displayName);
      setBio(userData.bio || "");
      setResearchInterests(userData.researchInterests || []);
      setAvatar(userData.avatar);

      if (isOwnProfile) {
        const { stats: userStats } = await api.getUserStats();
        setStats(userStats);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadTabData(tab: string) {
    try {
      switch (tab) {
        case "collections":
          const { collections: cols } = await api.getUserCollections(userId!);
          setCollections(cols);
          break;
        case "uploads":
          const { papers } = await api.getUserUploads(userId!);
          setUploads(papers);
          break;
        case "following":
          const { users: followingUsers } = await api.getFollowing(userId!);
          setFollowing(followingUsers);
          break;
        case "followers":
          const { users: followerUsers } = await api.getFollowers(userId!);
          setFollowers(followerUsers);
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${tab}:`, error);
    }
  }

  async function handleFollow() {
    if (!currentUser || !userId) return;
    try {
      if (profile?.isFollowing) {
        await api.unfollowUser(userId);
        setProfile((p) => p ? { ...p, isFollowing: false, followerCount: p.followerCount - 1 } : null);
        toast.success("Unfollowed successfully");
      } else {
        await api.followUser(userId);
        setProfile((p) => p ? { ...p, isFollowing: true, followerCount: p.followerCount + 1 } : null);
        toast.success("Following!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update follow status");
    }
  }

  async function handleFollowUser(targetUserId: string, isCurrentlyFollowing: boolean) {
    if (!currentUser) return;
    try {
      if (isCurrentlyFollowing) {
        await api.unfollowUser(targetUserId);
      } else {
        await api.followUser(targetUserId);
      }
      // Refresh the list
      loadTabData(activeTab);
    } catch (error: any) {
      toast.error(error.message || "Failed to update follow status");
    }
  }

  async function handleRemoveFromCollection(paperId: string) {
    try {
      await api.removeFromCollection(paperId);
      setCollections((cols) => cols.filter((c) => c.paperId !== paperId));
      setProfile((p) => p ? { ...p, collectionCount: p.collectionCount - 1 } : null);
      toast.success("Removed from collection");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove from collection");
    }
  }

  async function handleSaveProfile() {
    try {
      const updated = await api.updateProfile({
        displayName,
        bio,
        researchInterests,
        avatar,
      });
      setProfile((p) => p ? { ...p, ...updated } : null);
      setIsEditing(false);
      toast.success("Profile updated successfully");
      refreshUser();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      await api.changePassword({ currentPassword, newPassword });
      toast.success("Password changed successfully");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    }
  }

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error("Avatar must be less than 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatar(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function addInterest(interest: string) {
    const trimmed = interest.trim();
    if (trimmed && !researchInterests.includes(trimmed) && researchInterests.length < 20) {
      setResearchInterests([...researchInterests, trimmed]);
      setNewInterest("");
    }
  }

  function removeInterest(interest: string) {
    setResearchInterests(researchInterests.filter((i) => i !== interest));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground">User not found</p>
          <Link href="/">
            <Button variant="link" className="mt-4">
              Go Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Profile</h1>
          </div>
          <div className="flex gap-2">
            {!isOwnProfile && currentUser && (
              <Button
                variant={profile.isFollowing ? "outline" : "default"}
                onClick={handleFollow}
              >
                {profile.isFollowing ? (
                  <>
                    <UserMinus className="w-4 h-4 mr-2" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>
            )}
            {isOwnProfile && !isEditing && (
              <Button onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid gap-6">
          {/* Profile Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-32 h-32 rounded-full bg-muted flex items-center justify-center overflow-hidden relative ${
                      isEditing ? "cursor-pointer hover:opacity-80" : ""
                    }`}
                    onClick={isEditing ? handleAvatarClick : undefined}
                  >
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-16 h-16 text-muted-foreground" />
                    )}
                    {isEditing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-full">
                        <Camera className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={handleAvatarClick}>
                      <Camera className="w-4 h-4 mr-1" />
                      Change
                    </Button>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="text-sm font-medium">Display Name</label>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your display name"
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Bio</label>
                        <Textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Tell us about yourself..."
                          maxLength={500}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                        <p className="text-muted-foreground">@{profile.username}</p>
                      </div>
                      {profile.bio && <p className="text-sm">{profile.bio}</p>}

                      {/* Social Stats */}
                      <div className="flex gap-6 text-sm">
                        <button
                          className="hover:text-primary"
                          onClick={() => setActiveTab("followers")}
                        >
                          <span className="font-bold">{profile.followerCount}</span>{" "}
                          <span className="text-muted-foreground">Followers</span>
                        </button>
                        <button
                          className="hover:text-primary"
                          onClick={() => setActiveTab("following")}
                        >
                          <span className="font-bold">{profile.followingCount}</span>{" "}
                          <span className="text-muted-foreground">Following</span>
                        </button>
                        <button
                          className="hover:text-primary"
                          onClick={() => setActiveTab("collections")}
                        >
                          <span className="font-bold">{profile.collectionCount}</span>{" "}
                          <span className="text-muted-foreground">Collections</span>
                        </button>
                        <button
                          className="hover:text-primary"
                          onClick={() => setActiveTab("uploads")}
                        >
                          <span className="font-bold">{profile.uploadCount}</span>{" "}
                          <span className="text-muted-foreground">Uploads</span>
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Member since {new Date(profile.createdAt * 1000).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Research Interests */}
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Research Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {(isEditing ? researchInterests : profile.researchInterests || []).map(
                    (interest) => (
                      <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                        {interest}
                        {isEditing && (
                          <button
                            onClick={() => removeInterest(interest)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </Badge>
                    )
                  )}
                  {!isEditing && (!profile.researchInterests || profile.researchInterests.length === 0) && (
                    <p className="text-sm text-muted-foreground">No research interests set</p>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        placeholder="Add a research interest..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addInterest(newInterest);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => addInterest(newInterest)}
                        disabled={!newInterest.trim()}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {SUGGESTED_INTERESTS.filter((i) => !researchInterests.includes(i))
                        .slice(0, 8)
                        .map((interest) => (
                          <Button
                            key={interest}
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => addInterest(interest)}
                          >
                            + {interest}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Edit Actions */}
              {isEditing && (
                <div className="mt-6 flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs for Collections, Uploads, Following, Followers */}
          <Card>
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="collections" className="flex items-center gap-1">
                    <Bookmark className="w-4 h-4" />
                    <span className="hidden sm:inline">Collections</span>
                  </TabsTrigger>
                  <TabsTrigger value="uploads" className="flex items-center gap-1">
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Uploads</span>
                  </TabsTrigger>
                  <TabsTrigger value="following" className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Following</span>
                  </TabsTrigger>
                  <TabsTrigger value="followers" className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Followers</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="collections" className="mt-4">
                  {collections.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No papers collected yet</p>
                  ) : (
                    <div className="space-y-3">
                      {collections.map((col) => (
                        <div key={col.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex-1 min-w-0">
                            <Link href={`/paper/${col.paperId}`}>
                              <p className="font-medium truncate hover:text-primary">{col.paperTitle}</p>
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">
                              {col.paperAuthors.join(", ")}
                            </p>
                            {col.note && (
                              <p className="text-xs text-muted-foreground mt-1 italic">"{col.note}"</p>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Link href={`/paper/${col.paperId}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                            {isOwnProfile && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFromCollection(col.paperId)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="uploads" className="mt-4">
                  {uploads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No papers uploaded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {uploads.map((paper) => (
                        <div key={paper.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex-1 min-w-0">
                            <Link href={`/paper/${paper.id}`}>
                              <p className="font-medium truncate hover:text-primary">{paper.title}</p>
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">
                              {paper.authors.join(", ")}
                            </p>
                            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                              <span>{paper.readerCount} readers</span>
                              <span>{paper.annotationCount} annotations</span>
                            </div>
                          </div>
                          <Link href={`/paper/${paper.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="following" className="mt-4">
                  {following.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Not following anyone yet</p>
                  ) : (
                    <div className="space-y-3">
                      {following.map((user) => (
                        <UserListItem
                          key={user.id}
                          user={user}
                          currentUserId={currentUser?.id}
                          onFollow={() => handleFollowUser(user.id, user.isFollowing || false)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="followers" className="mt-4">
                  {followers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No followers yet</p>
                  ) : (
                    <div className="space-y-3">
                      {followers.map((user) => (
                        <UserListItem
                          key={user.id}
                          user={user}
                          currentUserId={currentUser?.id}
                          onFollow={() => handleFollowUser(user.id, user.isFollowing || false)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Stats Card (only for own profile) */}
          {isOwnProfile && stats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <MessageSquare className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{stats.annotationCount}</p>
                    <p className="text-sm text-muted-foreground">Annotations</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <BookOpen className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold">{stats.papersRead}</p>
                    <p className="text-sm text-muted-foreground">Papers Read</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <FileText className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                    <p className="text-2xl font-bold">{stats.reviewsWritten}</p>
                    <p className="text-sm text-muted-foreground">Reviews</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Bot className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                    <p className="text-2xl font-bold">{stats.aiSessions}</p>
                    <p className="text-sm text-muted-foreground">AI Sessions</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/my-annotations">
                    <Button variant="outline" size="sm">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Manage Annotations
                    </Button>
                  </Link>
                  <Link href="/my-comments">
                    <Button variant="outline" size="sm">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Manage Comments
                    </Button>
                  </Link>
                  <Link href="/my-reviews">
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Manage Reviews
                    </Button>
                  </Link>
                  <Link href="/my-ai-sessions">
                    <Button variant="outline" size="sm">
                      <Bot className="w-4 h-4 mr-2" />
                      Manage AI Sessions
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Password Change (only for own profile) */}
          {isOwnProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showPasswordChange ? (
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="text-sm font-medium">Current Password</label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">New Password</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 characters)"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Confirm New Password</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowPasswordChange(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleChangePassword}>Change Password</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setShowPasswordChange(true)}>
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

// User List Item Component
function UserListItem({
  user,
  currentUserId,
  onFollow,
}: {
  user: UserSummary;
  currentUserId?: string;
  onFollow: () => void;
}) {
  const isOwnUser = currentUserId === user.id;

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <Link href={`/profile/${user.id}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium hover:text-primary">{user.displayName}</p>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
        </div>
      </Link>
      {currentUserId && !isOwnUser && (
        <Button
          variant={user.isFollowing ? "outline" : "default"}
          size="sm"
          onClick={onFollow}
        >
          {user.isFollowing ? "Unfollow" : "Follow"}
        </Button>
      )}
    </div>
  );
}
