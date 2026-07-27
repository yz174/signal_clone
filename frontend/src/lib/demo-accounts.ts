export interface DemoAccount {
  phone: string;
  name: string;
  username: string;
  color: string;
}

export const DEMO_CODE = "123456";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { phone: "+15550100001", name: "Ava Mitchell", username: "ava", color: "A210" },
  { phone: "+15550100002", name: "Noah Berger", username: "noah", color: "A200" },
  { phone: "+15550100003", name: "Mia Fernandes", username: "mia", color: "A210" },
  { phone: "+15550100004", name: "Liam O'Donnell", username: "liam", color: "A110" },
  { phone: "+15550100005", name: "Zoe Nakamura", username: "zoe", color: "A140" },
  { phone: "+15550100006", name: "Kai Ramirez", username: "kai", color: "A170" },
  { phone: "+15550100007", name: "Inés Duarte", username: "ines", color: "A190" },
  { phone: "+15550100008", name: "Omar Haddad", username: "omar", color: "A180" },
  { phone: "+15550100009", name: "Sara Lindqvist", username: "sara", color: "A100" },
  { phone: "+15550100010", name: "Theo Almeida", username: "theo", color: "A110" },
];

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("1")) return phone;
  return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}
