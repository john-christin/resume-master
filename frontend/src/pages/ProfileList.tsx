import {
  AlertCircle,
  Briefcase,
  GraduationCap,
  Plus,
  Share2,
  Trash2,
  User,
  Wand2,
} from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteProfile, getProfiles } from "../api/profile";
import { getUserRole } from "../auth";
import LoadingSpinner from "../components/LoadingSpinner";
import ShareDialog from "../components/ShareDialog";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import type { Profile } from "../types";

function ProfileCard({
  profile,
  isAdmin,
  isShared,
  onEdit,
  onGenerate,
  onShare,
  onDelete,
}: {
  profile: Profile;
  isAdmin: boolean;
  isShared: boolean;
  onEdit: () => void;
  onGenerate: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className={isShared ? "border-primary/30 bg-accent/10" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{profile.name}</CardTitle>
              {profile.email && (
                <CardDescription className="text-xs truncate">
                  {profile.email}
                </CardDescription>
              )}
            </div>
          </div>
          {isShared && profile.owner_username && (
            <Badge variant="info" className="shrink-0 text-[10px]">
              {profile.owner_username}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            {profile.educations.length} education
          </span>
          <span className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" />
            {profile.experiences.length} experience
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>
            {isAdmin ? "Edit" : isShared ? "View" : "Edit"}
          </Button>
          <Button variant="default" size="sm" className="h-7 text-xs" onClick={onGenerate}>
            <Wand2 className="h-3 w-3" />
            Generate
          </Button>
          {(!isShared || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
              onClick={onShare}
            >
              <Share2 className="h-3 w-3" />
              Share
            </Button>
          )}
          {(!isShared || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfileList() {
  const navigate = useNavigate();
  const role = getUserRole();
  const isAdmin = role === "admin";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingProfileId, setSharingProfileId] = useState<string | null>(null);

  useEffect(() => {
    getProfiles()
      .then((res) => setProfiles(res.data))
      .catch(() => setError("Failed to load profiles"))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (profileId: string) => {
    if (!window.confirm("Are you sure you want to delete this profile?")) return;
    try {
      await deleteProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch {
      setError("Failed to delete profile");
    }
  };

  if (loading) return <LoadingSpinner message="Loading profiles..." />;

  const ownProfiles = profiles.filter((p) => p.is_owner);
  const sharedProfiles = profiles.filter((p) => p.is_shared && !p.is_owner);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Manage your resume profiles"
        actions={
          <Button onClick={() => navigate("/profiles/new")}>
            <Plus className="h-4 w-4" />
            New Profile
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {ownProfiles.length === 0 && sharedProfiles.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">No profiles yet.</p>
            <Button onClick={() => navigate("/profiles/new")}>
              <Plus className="h-4 w-4" />
              Create Your First Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {ownProfiles.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                My Profiles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isAdmin={isAdmin}
                    isShared={false}
                    onEdit={() => navigate(`/profiles/${profile.id}`)}
                    onGenerate={() =>
                      navigate("/generate", {
                        state: { profileId: profile.id },
                      })
                    }
                    onShare={() => setSharingProfileId(profile.id)}
                    onDelete={() => handleDelete(profile.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sharedProfiles.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {isAdmin ? "Other Users' Profiles" : "Shared With Me"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sharedProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isAdmin={isAdmin}
                    isShared
                    onEdit={() => navigate(`/profiles/${profile.id}`)}
                    onGenerate={() =>
                      navigate("/generate", {
                        state: { profileId: profile.id },
                      })
                    }
                    onShare={() => setSharingProfileId(profile.id)}
                    onDelete={() => handleDelete(profile.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sharingProfileId && (
        <ShareDialog
          profileId={sharingProfileId}
          onClose={() => setSharingProfileId(null)}
        />
      )}
    </div>
  );
}
