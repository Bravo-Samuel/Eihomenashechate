import type { DirectoryMember } from "./directoryApi";

export type UpcomingCelebration = {
  id: string;
  name: string;
  role: string;
  country: string;
  whatsapp?: string;
  email?: string;
  phone?: string;
  type: "birthday" | "aliyah";
  days: number;
};

export function buildUpcomingCelebrations(
  members: DirectoryMember[],
  daysUntilAnniversary: (date: string) => number,
  maxDays = 7,
): UpcomingCelebration[] {
  const celebrations: UpcomingCelebration[] = [];

  for (const member of members) {
    if (member.status !== "approved") continue;

    if (member.birthday) {
      const days = daysUntilAnniversary(member.birthday);
      if (days >= 0 && days <= maxDays) {
        celebrations.push({
          id: member.id,
          name: member.name,
          role: member.role,
          country: member.country,
          whatsapp: member.whatsapp,
          email: member.email,
          phone: member.phone,
          type: "birthday",
          days,
        });
      }
    }

    if (member.aliyahDate) {
      const days = daysUntilAnniversary(member.aliyahDate);
      if (days >= 0 && days <= maxDays) {
        celebrations.push({
          id: `${member.id}-al`,
          name: member.name,
          role: member.role,
          country: member.country,
          whatsapp: member.whatsapp,
          email: member.email,
          phone: member.phone,
          type: "aliyah",
          days,
        });
      }
    }
  }

  return celebrations.sort((a, b) => a.days - b.days);
}
