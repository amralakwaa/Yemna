/** فلسفة يمنا: مكونات عربية صغيرة، ذات سطح أبيض وخط واضح وتفاصيل عنابية مقتصدة. */
import type { ReactNode } from "react";
import { Check, Search } from "lucide-react";
import type { Person } from "@/lib/yemnaData";

export function Avatar({ person, size = "md", ring = false }: { person: Person; size?: "sm" | "md" | "lg" | "xl"; ring?: boolean }) {
  return <span className={`avatar avatar-${size} ${ring ? "story-ring" : ""}`}><img src={person.avatar} alt={person.name} />{person.online && <i className="online-dot" />}</span>;
}

export function Verified() { return <span className="verified" aria-label="حساب موثق"><Check size={11} strokeWidth={3} /></span>; }

export function SearchBox({ value, onChange, placeholder = "ابحث في يمنا..." }: { value?: string; onChange?: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Search size={18}/><input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>;
}

export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`surface ${className}`}>{children}</section>; }

export function SectionHeading({ title, action, icon }: { title: string; action?: ReactNode; icon?: ReactNode }) {
  return <header className="section-heading"><h2>{icon}{title}</h2>{action && <div>{action}</div>}</header>;
}

export function Pill({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) { return <button type="button" onClick={onClick} className={`pill ${active ? "is-active" : ""}`}>{children}</button>; }
