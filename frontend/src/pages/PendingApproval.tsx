import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export default function PendingApproval() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/60 via-background to-muted/30 flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Awaiting Approval</CardTitle>
          <CardDescription className="text-base">
            Your account is pending admin review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You will be able to access the application once an administrator
            reviews and approves your account.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              clearAuth();
              navigate("/login");
            }}
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
