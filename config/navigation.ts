import { Icons } from "@/components/Icons";

export interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiresAttendanceManager?: boolean;
  requiresWorkloadAccess?: boolean;
  requiresHeadRole?: boolean;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "",
    links: [{ label: "Dashboard", href: "/dashboard", icon: Icons.dashboard }],
  },
  {
    title: "PR & Social",
    links: [
      { label: "Analytics", href: "/social", icon: Icons.chart },
      { label: "Content Calendar", href: "/social/calendar", icon: Icons.calendar },
    ],
  },
  {
    title: "Projects",
    links: [
      { label: "Overview", href: "/projects/overview", icon: Icons.overview },
      { label: "Project Board", href: "/projects", icon: Icons.projects },
      { label: "Project Outcomes", href: "/projects/impact", icon: Icons.impact },
    ],
  },
  {
    title: "Logistics",
    links: [
      { label: "Inventory", href: "/logistics/inventory", icon: Icons.inventory },
      { label: "Expenses", href: "/logistics/expenses", icon: Icons.expenses },
    ],
  },
  {
    title: "Organization",
    links: [
      { label: "Events", href: "/events", icon: Icons.events },
      {
        label: "Attendance",
        href: "/attendance",
        icon: Icons.attendance,
        requiresAttendanceManager: true,
      },
      { label: "Team Directory", href: "/team", icon: Icons.team },
      {
        label: "Workload View",
        href: "/team/workload",
        icon: Icons.workload,
        requiresWorkloadAccess: true,
      },
      {
        label: "Summary",
        href: "/summary",
        icon: Icons.summary,
        requiresHeadRole: true,
      },
    ],
  },
];
