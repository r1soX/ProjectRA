export type PersonName = {
  lastName: string;
  firstName: string;
  middleName?: string | null;
};

/** «Смолин Владислав Сергеевич» */
export function fullName(p: PersonName): string {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");
}

/** «Смолин В.» — для обращений и списков */
export function shortName(p: PersonName): string {
  const initial = p.firstName.charAt(0).toUpperCase();
  return initial ? `${p.lastName} ${initial}.` : p.lastName;
}

/** «Владислав» — для приветствий */
export function greetingName(p: PersonName): string {
  return p.firstName;
}

/** «ВС» — для аватара */
export function initials(p: PersonName): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}
