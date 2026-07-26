"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import type { SearchResults as Results } from "@/lib/api/types";
import { formatListTimestamp } from "@/lib/format";

interface SearchResultsProps {
  results: Results;
  onNavigate: () => void;
}

export function SearchResults({ results, onNavigate }: SearchResultsProps) {
  const empty =
    results.contacts.length === 0 &&
    results.conversations.length === 0 &&
    results.messages.length === 0;

  if (empty) {
    return <p className="px-4 py-6 text-sm text-faint">Nothing matches that search.</p>;
  }

  return (
    <div className="pb-3">
      {results.conversations.length > 0 && (
        <Section title="Chats">
          {results.conversations.map((hit) => (
            <Link
              key={hit.id}
              href={`/chats/${hit.id}`}
              onClick={onNavigate}
              className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-hover"
            >
              <Avatar name={hit.title} color="A200" group={hit.type === "group"} size={40} />
              <span className="truncate text-sm text-body">{hit.title}</span>
            </Link>
          ))}
        </Section>
      )}

      {results.contacts.length > 0 && (
        <Section title="Contacts">
          {results.contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar
                name={contact.display_name}
                color={contact.avatar_color}
                imageUrl={contact.avatar_url}
                size={40}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-body">{contact.display_name}</span>
                <span className="block truncate text-xs text-muted">
                  {contact.username ? `@${contact.username}` : contact.phone_e164}
                </span>
              </span>
            </div>
          ))}
        </Section>
      )}

      {results.messages.length > 0 && (
        <Section title="Messages">
          {results.messages.map((hit) => (
            <Link
              key={hit.message.id}
              href={`/chats/${hit.conversation_id}`}
              onClick={onNavigate}
              className="block px-4 py-2.5 transition hover:bg-hover"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-body">
                  {hit.conversation_title}
                </span>
                <span className="shrink-0 text-xs text-faint">
                  {formatListTimestamp(hit.message.created_at)}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-muted">{hit.message.body}</span>
            </Link>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-3">
      <h2 className="px-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
