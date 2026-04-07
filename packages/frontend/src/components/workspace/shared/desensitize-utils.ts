const TYPE_LABELS: Record<string, string> = {
  name: "姓名",
  person_name: "姓名",
  phone: "电话",
  phone_number: "手机号",
  email: "邮箱",
  id: "证件",
  id_number: "身份证号",
  bank: "银行卡",
  bank_card: "银行卡号",
  company_name: "公司名",
  org: "机构",
  address: "地址",
  date: "日期",
  amount: "金额",
  ip: "IP地址",
};

/** Strip trailing digit suffix (_1, _2), then lowercase lookup */
export function getTypeLabel(sensitiveType: string): string {
  const stripped = sensitiveType.replace(/_\d+$/, "");
  const normalized = stripped.toLowerCase();
  return TYPE_LABELS[normalized] ?? sensitiveType;
}

/** Surface-tone pills per design system */
export function typeBadgeClass(type: string): string {
  const normalized = type.replace(/_\d+$/, "").toLowerCase();
  const map: Record<string, string> = {
    person_name: "bg-indigo-50 text-indigo-700",
    name: "bg-indigo-50 text-indigo-700",
    phone_number: "bg-emerald-50 text-emerald-700",
    phone: "bg-emerald-50 text-emerald-700",
    email: "bg-violet-50 text-violet-700",
    id_number: "bg-rose-50 text-rose-700",
    id: "bg-rose-50 text-rose-700",
    bank_card: "bg-amber-50 text-amber-700",
    bank: "bg-amber-50 text-amber-700",
    company_name: "bg-teal-50 text-teal-700",
    org: "bg-teal-50 text-teal-700",
    address: "bg-pink-50 text-pink-700",
    date: "bg-sky-50 text-sky-700",
    amount: "bg-orange-50 text-orange-700",
    ip: "bg-gray-50 text-gray-700",
  };
  return map[normalized] ?? "bg-[#f7f9fb] text-[#464555]";
}

/** Mask middle characters for display */
export function maskOriginal(text: string): string {
  if (text.length <= 2) return text;
  const visible = Math.max(1, Math.floor(text.length / 3));
  return text.slice(0, visible) + "*".repeat(text.length - visible * 2) + text.slice(-visible);
}
