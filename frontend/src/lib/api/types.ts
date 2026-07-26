import type { components } from "./schema";

type Schemas = components["schemas"];

export type User = Schemas["UserOut"];
export type Conversation = Schemas["ConversationOut"];
export type ConversationPage = Schemas["ConversationPageOut"];
export type ConversationType = Schemas["ConversationType"];
export type Member = Schemas["MemberOut"];
export type MemberRole = Schemas["MemberRole"];
export type Message = Schemas["MessageOut"];
export type MessagePage = Schemas["MessagePageOut"];
export type Receipt = Schemas["ReceiptOut"];
export type Contact = Schemas["ContactOut"];
export type SearchResults = Schemas["SearchResultsOut"];
export type TokenPair = Schemas["TokenPair"];
export type Authenticated = Schemas["AuthenticatedOut"];
export type RegistrationRequired = Schemas["RegistrationRequiredOut"];
export type VerifyOtpResult = Authenticated | RegistrationRequired;

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type LocalMessage = Message & { pending?: boolean; failed?: boolean };
