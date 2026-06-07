import { useState, useEffect } from "react";
import { createCall, deleteCall, updateCall } from "../../api/calls";
import type { Call, CallCreate, CallStageConfig, CallStatus, CallType, CallUpdate } from "../../types";
import { CALL_STATUSES } from "../../types";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

interface CallFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  jobTitle: string;
  company?: string;
  existingCall?: Call;
  stages: CallStageConfig[];
  onSuccess: (call: Call) => void;
  onDelete?: () => void;
}

const toLocalDatetime = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CallFormDialog({
  open,
  onOpenChange,
  applicationId,
  jobTitle,
  company,
  existingCall,
  stages,
  onSuccess,
  onDelete,
}: CallFormDialogProps) {
  const isEdit = !!existingCall;

  const [stage, setStage] = useState<string>("");
  const [status, setStatus] = useState<CallStatus>("scheduled");
  const [scheduledAt, setScheduledAt] = useState("");
  const [withWhom, setWithWhom] = useState("");
  const [interviewerRole, setInterviewerRole] = useState("");
  const [callType, setCallType] = useState<CallType | "">("");
  const [callLink, setCallLink] = useState("");
  const [recordingLink, setRecordingLink] = useState("");
  const [additionalNote, setAdditionalNote] = useState("");
  const [stageError, setStageError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setStage(existingCall?.stage ?? stages[0]?.value ?? "");
      setStatus(existingCall?.status ?? "scheduled");
      setScheduledAt(toLocalDatetime(existingCall?.scheduled_at));
      setWithWhom(existingCall?.with_whom ?? "");
      setInterviewerRole(existingCall?.interviewer_role ?? "");
      setCallType(existingCall?.call_type ?? "");
      setCallLink(existingCall?.call_link ?? "");
      setRecordingLink(existingCall?.recording_link ?? "");
      setAdditionalNote(existingCall?.additional_note ?? "");
      setStageError(false);
    }
  }, [open, existingCall]);

  const handleSubmit = async () => {
    if (!stage) {
      setStageError(true);
      return;
    }
    setLoading(true);
    try {
      const scheduledAtIso = scheduledAt ? new Date(scheduledAt).toISOString() : null;
      if (isEdit && existingCall) {
        const payload: CallUpdate = {
          stage,
          status,
          scheduled_at: scheduledAtIso,
          with_whom: withWhom || null,
          interviewer_role: interviewerRole || null,
          call_type: callType || null,
          call_link: callLink || null,
          recording_link: recordingLink || null,
          additional_note: additionalNote || null,
        };
        const res = await updateCall(existingCall.id, payload);
        onSuccess(res.data);
      } else {
        const payload: CallCreate = {
          application_id: applicationId,
          stage,
          status,
          scheduled_at: scheduledAtIso,
          with_whom: withWhom || null,
          interviewer_role: interviewerRole || null,
          call_type: callType || null,
          call_link: callLink || null,
          recording_link: recordingLink || null,
          additional_note: additionalNote || null,
        };
        const res = await createCall(payload);
        onSuccess(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingCall || !onDelete) return;
    setDeleting(true);
    try {
      await deleteCall(existingCall.id);
      onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Call" : "Schedule Call"}</DialogTitle>
          <DialogDescription>
            {jobTitle}{company ? ` — ${company}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Stage *</Label>
              <Select
                value={stage}
                onValueChange={(v) => { setStage(v); setStageError(false); }}
              >
                <SelectTrigger className={stageError ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stageError && <p className="text-xs text-destructive">Stage is required</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CallStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Scheduled At</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Interviewer</Label>
              <Input
                placeholder="Name"
                value={withWhom}
                onChange={(e) => setWithWhom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer Role</Label>
              <Input
                placeholder="e.g. Engineering Manager"
                value={interviewerRole}
                onChange={(e) => setInterviewerRole(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Call Type</Label>
              <Select
                value={callType}
                onValueChange={(v) => setCallType(v as CallType | "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Call Link</Label>
              <Input
                placeholder="Meeting URL"
                value={callLink}
                onChange={(e) => setCallLink(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Recording Link</Label>
            <Input
              placeholder="Recording URL"
              value={recordingLink}
              onChange={(e) => setRecordingLink(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Additional Note</Label>
            <Textarea
              placeholder="Any notes about this interview..."
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          {isEdit && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="mr-auto"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading || deleting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || deleting}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
