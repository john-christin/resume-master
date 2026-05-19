import {
  AlertCircle,
  Building2,
  ChevronLeft,
  Download,
  FileText,
  History,
  Loader2,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteApplication } from "../api/applications";
import { getUserRole } from "../auth";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import type { GenerateResponse } from "../types";

export default function Preview() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state as GenerateResponse | null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-muted-foreground">No preview data available.</p>
        <Button onClick={() => navigate("/generate")}>
          <Wand2 className="h-4 w-4" />
          Generate New Application
        </Button>
      </div>
    );
  }

  const {
    preview,
    resume_url,
    cover_letter_url,
    profile_name,
    job_title,
    company,
  } = data;
  const safeName = (profile_name ?? "Resume").trim().replace(/\s+/g, "_");
  const withName = (url: string, label: string) =>
    `${url}?name=${safeName}_${label}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{job_title}</h1>
          {company && (
            <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Building2 className="h-3.5 w-3.5" />
              {company}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-destructive/30 bg-destructive/5">
              <span className="text-sm text-destructive">Remove application?</span>
              <Button
                size="sm"
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteApplication(data.application_id);
                    navigate("/history");
                  } catch {
                    setDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {deleting ? "Removing…" : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/generate")}
          >
            <Wand2 className="h-4 w-4" />
            Generate Another
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/history")}
          >
            <History className="h-4 w-4" />
            History
          </Button>
        </div>
      </div>

      {/* Cost info - admin only */}
      {getUserRole() === "admin" &&
        (data.prompt_tokens > 0 || data.completion_tokens > 0) && (
          <Alert variant="info">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap gap-4">
              <span>Prompt tokens: {data.prompt_tokens.toLocaleString()}</span>
              <span>
                Completion tokens: {data.completion_tokens.toLocaleString()}
              </span>
              <span className="font-semibold">
                Cost: ${data.cost.toFixed(4)}
              </span>
            </AlertDescription>
          </Alert>
        )}

      {/* Downloads */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Download Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a href={withName(resume_url, "Resume.pdf")}>
            <Button variant="success" size="sm">
              <FileText className="h-4 w-4" />
              Resume PDF
            </Button>
          </a>
          <a
            href={withName(
              resume_url.replace(".pdf", ".docx"),
              "Resume.docx"
            )}
          >
            <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800">
              <Download className="h-4 w-4" />
              Resume DOCX
            </Button>
          </a>
          <a href={withName(cover_letter_url, "Cover_Letter.pdf")}>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
              <FileText className="h-4 w-4" />
              Cover Letter PDF
            </Button>
          </a>
          <a
            href={withName(
              cover_letter_url.replace(".pdf", ".docx"),
              "Cover_Letter.docx"
            )}
          >
            <Button variant="outline" size="sm" className="text-violet-600 border-violet-200 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800">
              <Download className="h-4 w-4" />
              Cover Letter DOCX
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Preview tabs */}
      <Tabs defaultValue="resume">
        <TabsList>
          <TabsTrigger value="resume">Resume Preview</TabsTrigger>
          <TabsTrigger value="cover_letter">Cover Letter</TabsTrigger>
        </TabsList>

        <TabsContent value="resume">
          <Card>
            <CardContent className="p-6 space-y-6">
              {preview.summary && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Summary
                  </h2>
                  <Separator className="mb-3" />
                  <p className="text-sm leading-relaxed">{preview.summary}</p>
                </div>
              )}

              {preview.skills && preview.skills.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Technical Skills
                  </h2>
                  <Separator className="mb-3" />
                  <div className="space-y-1.5">
                    {preview.skills.map((cat, index) => (
                      <p key={index} className="text-sm">
                        <span className="font-semibold">{cat.category}: </span>
                        <span className="text-muted-foreground">
                          {cat.skills.join(", ")}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Professional Experience
                </h2>
                <Separator className="mb-3" />
                <div className="space-y-6">
                  {preview.tailored_experiences.map((exp, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-sm">
                          {exp.company}
                          {exp.location && (
                            <span className="text-muted-foreground font-normal">
                              , {exp.location}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                          {exp.start_date} – {exp.end_date || "Present"}
                        </Badge>
                      </div>
                      <p className="text-sm italic text-muted-foreground mt-0.5">
                        {exp.title}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {exp.bullets.map((bullet, bi) => (
                          <li
                            key={bi}
                            className="text-sm pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover_letter">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4 max-w-2xl">
                {preview.cover_letter.split("\n\n").map((para, index) => (
                  <p key={index} className="text-sm leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => navigate("/generate")}
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Generate
      </Button>
    </div>
  );
}
