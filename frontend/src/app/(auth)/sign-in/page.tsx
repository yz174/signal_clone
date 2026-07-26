"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SignalLogo } from "@/components/SignalLogo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError, api } from "@/lib/api/client";
import { useSession } from "@/lib/store/session";

type Step = "phone" | "code" | "profile";

export default function SignInPage() {
  const router = useRouter();
  const { status, adopt, restore } = useSession();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+15550100001");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/chats");
  }, [status, router]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const requestCode = () =>
    run(async () => {
      await api.requestOtp(phone.trim());
      setStep("code");
    });

  const verifyCode = () =>
    run(async () => {
      const result = await api.verifyOtp(phone.trim(), code.trim());
      if (result.status === "authenticated") {
        adopt(result);
        router.replace("/chats");
        return;
      }
      setRegistrationToken(result.registration_token);
      setStep("profile");
    });

  const completeProfile = () =>
    run(async () => {
      const session = await api.register(
        registrationToken,
        displayName.trim(),
        username.trim() || undefined,
      );
      adopt(session);
      router.replace("/chats");
    });

  return (
    <main className="bg-surface flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <SignalLogo size={56} className="text-accent" />
          <h1 className="text-body mt-5 text-2xl font-semibold">Signal</h1>
          <p className="text-muted mt-2 text-sm">
            {step === "phone" && "Enter your phone number to get started."}
            {step === "code" && `We sent a code to ${phone}.`}
            {step === "profile" && "Choose how you appear to others."}
          </p>
        </div>

        <div className="space-y-5">
          {step === "phone" && (
            <>
              <TextField
                label="Phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+15550100001"
                inputMode="tel"
                autoFocus
                error={error}
                hint="Seeded demo accounts run from +15550100001 to +15550100010."
              />
              <Button fullWidth onClick={requestCode} disabled={busy || phone.trim().length < 8}>
                {busy ? "Sending…" : "Continue"}
              </Button>
            </>
          )}

          {step === "code" && (
            <>
              <TextField
                label="Verification code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                error={error}
                hint="Verification is mocked for this demo: the code is 123456."
              />
              <Button fullWidth onClick={verifyCode} disabled={busy || code.trim().length < 4}>
                {busy ? "Verifying…" : "Verify"}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
              >
                Use a different number
              </Button>
            </>
          )}

          {step === "profile" && (
            <>
              <TextField
                label="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ada Lovelace"
                autoFocus
                error={error}
              />
              <TextField
                label="Username (optional)"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                placeholder="ada"
                hint="Lowercase letters, numbers, dots and underscores."
              />
              <Button
                fullWidth
                onClick={completeProfile}
                disabled={busy || displayName.trim().length === 0}
              >
                {busy ? "Creating…" : "Create account"}
              </Button>
            </>
          )}
        </div>

        <p className="text-faint mt-10 text-center text-xs">
          Encryption is simulated. This is a portfolio clone, not the real Signal.
        </p>
      </div>
    </main>
  );
}
