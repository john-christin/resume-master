import { ShieldOff } from "lucide-react";
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

export default function Suspended() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/60 via-background to-muted/30 flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ShieldOff className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl">Account Suspended</CardTitle>
          <CardDescription className="text-base">
            Your account access has been restricted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your account has been suspended by an administrator. Please contact
            your organization's admin for more information.
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
