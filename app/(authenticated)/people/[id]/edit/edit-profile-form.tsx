"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  updateProfile,
  type UpdateProfileState,
} from "../actions";

type Member = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  socialInstagram: string | null;
  socialLinkedin: string | null;
  socialWhatsapp: string | null;
  languages: string[];
};

export function EditProfileForm({ member }: { member: Member }) {
  const [state, action, pending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="memberId" value={member.id} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Avatar URL</span>
        <input
          name="avatarUrl"
          type="url"
          defaultValue={member.avatarUrl ?? ""}
          placeholder="https://…/photo.jpg"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          Leave blank to fall back to the initials block.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Bio</span>
        <textarea
          name="bio"
          defaultValue={member.bio ?? ""}
          rows={5}
          maxLength={2000}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span>Instagram URL</span>
          <input
            name="socialInstagram"
            type="url"
            defaultValue={member.socialInstagram ?? ""}
            placeholder="https://instagram.com/…"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span>LinkedIn URL</span>
          <input
            name="socialLinkedin"
            type="url"
            defaultValue={member.socialLinkedin ?? ""}
            placeholder="https://linkedin.com/in/…"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span>WhatsApp URL</span>
          <input
            name="socialWhatsapp"
            type="url"
            defaultValue={member.socialWhatsapp ?? ""}
            placeholder="https://wa.me/…"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm">
        <span>Languages</span>
        <input
          name="languagesRaw"
          type="text"
          defaultValue={member.languages.join(", ")}
          placeholder="English, Arabic, Turkish"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          Comma-separated. Up to 20 entries.
        </span>
      </label>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/people/${member.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to profile
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
