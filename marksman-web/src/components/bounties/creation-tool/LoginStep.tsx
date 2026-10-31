import { AuthButton } from "@/components/auth/AuthButton";
import Button from "@/components/ui/Button";
import { LoginStepProps } from "./BountyCreationTool";

export default function LoginStep({ props }: { props: LoginStepProps }) {
  return (
    <div className="flex place-content-center">
      {props.accountLoading ? <p role="status">Loading account...</p> : null}
      {props.accountError ? (
        <div className="flex flex-col gap-2">
          <p role="alert">{props.accountError}</p>
          <Button onClick={props.refreshUser} type="button">
            Retry
          </Button>
        </div>
      ) : null}
      {!props.accountLoading && !props.accountError && !props.user ? (
        <AuthButton />
      ) : null}
      {!props.accountLoading && props.user ? (
        <div className="flex flex-col gap-2">
          <p>Logged in as {props.user.identity.username}</p>
          <Button variant="accent" onClick={props.onContinue} type="button">
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
