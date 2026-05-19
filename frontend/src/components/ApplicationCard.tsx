import { Building2, Calendar, Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import type { ApplicationSummary } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface Props {
  application: ApplicationSummary;
  onDelete: (id: string) => void;
}

export default function ApplicationCard({ application, onDelete }: Props) {
  const date = new Date(application.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const appId = application.id;
  const safeName = (application.profile_name ?? "Resume")
    .trim()
    .replace(/\s+/g, "_");
  const dl = (type: string, ext: string) =>
    `/api/download/${appId}_${type}${ext}?name=${safeName}_${type === "resume" ? "Resume" : "Cover_Letter"}${ext}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">
              {application.job_title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {application.company}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{date}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(application.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {application.job_url && (
          <a
            href={application.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
          >
            <ExternalLink className="h-3 w-3" />
            View Job Posting
          </a>
        )}

        <div className="flex flex-wrap gap-1.5 mt-3">
          <a href={dl("resume", ".pdf")}>
            <Badge
              variant="success"
              className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              Resume PDF
            </Badge>
          </a>
          <a href={dl("resume", ".docx")}>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Resume DOCX
            </Badge>
          </a>
          <a href={dl("cover_letter", ".pdf")}>
            <Badge
              variant="purple"
              className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              Cover Letter PDF
            </Badge>
          </a>
          <a href={dl("cover_letter", ".docx")}>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Cover Letter DOCX
            </Badge>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
