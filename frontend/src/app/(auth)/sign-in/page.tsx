"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DemoAccountPicker } from "@/components/auth/DemoAccountPicker";
import { SignalLogo } from "@/components/SignalLogo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { API_BASE, ApiError, api } from "@/lib/api/client";
import { DEMO_CODE, formatPhone } from "@/lib/demo-accounts";
import { useSession } from "@/lib/store/session";

type Step = "phone" | "code" | "profile";

const SLEEPS_WHEN_IDLE = !/localhost|127\.0\.0\.1/.test(API_BASE);

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
    <main className="bg-surface-sunken flex min-h-full items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <SignalLogo size={48} className="text-accent" />
          <h1 className="text-body mt-4 text-[26px] leading-tight font-semibold tracking-tight">
            Signal
          </h1>
          <p className="text-muted mt-1.5 text-sm">
            {step === "phone" && "Enter a phone number to get started."}
            {step === "code" && `We sent a code to ${formatPhone(phone)}.`}
            {step === "profile" && "Choose how you appear to others."}
          </p>
        </div>

        <div className="bg-surface border-line space-y-5 rounded-2xl border p-6 shadow-sm">
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
              />
              <Button fullWidth onClick={requestCode} disabled={busy || phone.trim().length < 8}>
                {!busy ? "Continue" : SLEEPS_WHEN_IDLE ? "Waking the server…" : "Sending…"}
              </Button>
              {SLEEPS_WHEN_IDLE && (
                <p
                  className={`text-xs leading-relaxed ${busy ? "text-muted" : "text-faint"}`}
                  aria-live="polite"
                >
                  {busy
                    ? "Still waking up. The first request can take up to a minute."
                    : "The free tier sleeps after 15 minutes idle, so the first Continue can take up to a minute. Instant after that."}
                </p>
              )}
              <DemoAccountPicker selected={phone.trim()} onSelect={setPhone} />
            </>
          )}

          {step === "code" && (
            <>
              <TextField
                label="Verification code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={DEMO_CODE}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                error={error}
              />
              <div className="border-line bg-surface-sunken flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-muted text-xs">
                  No SMS is sent. Every account uses the same code.
                </span>
                <button
                  type="button"
                  onClick={() => setCode(DEMO_CODE)}
                  aria-label={`Fill in the code ${DEMO_CODE}`}
                  className="border-line-strong bg-surface text-accent hover:border-accent shrink-0 rounded-md border px-2 py-1 text-sm font-semibold tabular-nums transition-colors duration-150 ease-out"
                >
                  {DEMO_CODE}
                </button>
              </div>
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

        <p className="text-faint mt-6 text-center text-xs">
          Encryption is simulated. This is a portfolio clone, not the real Signal.
        </p>
      </div>
    </main>
  );
}
