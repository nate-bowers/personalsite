import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

export type Slug = "about" | "projects" | "ask" | "resume" | "contact";

export const SECTIONS: { slug: Slug; label: string }[] = [
  { slug: "about", label: "About" },
  { slug: "projects", label: "Projects" },
  { slug: "ask", label: "Ask Nate" },
  { slug: "resume", label: "Resume" },
  { slug: "contact", label: "Contact" },
];

export interface ProjectCard {
  name: string;
  tagline: string;
  stack: string[];
  metrics: string[];
  links: StationLink[];
}
export interface StationLink {
  label: string;
  href: string;
}
export interface StationContent {
  slug: Slug;
  title: string;
  station: string;
  established: string;
  location: string;
  report: string;
  bodyHtml: string;
  projects?: ProjectCard[];
  facts?: string[];
  pdf?: string;
  links?: StationLink[];
  offline?: boolean;
}

const CONTENT_DIR = path.join(process.cwd(), "content");

export function getStation(slug: Slug): StationContent {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const body = content.trim();
  const bodyHtml = body ? (marked.parse(body) as string) : "";

  return {
    slug,
    title: data.title ?? slug,
    station: data.station ?? "",
    established: data.established ?? "",
    location: data.location ?? "",
    report: data.report ?? "",
    bodyHtml,
    projects: data.projects,
    facts: data.facts,
    pdf: data.pdf,
    links: data.links,
    offline: data.offline ?? false,
  };
}
