/** One row of the handbook table of contents: a section (level 1) or a heading (2/3). */
export interface TocItem {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  page: number;
  label: string;
  section: string;
}
