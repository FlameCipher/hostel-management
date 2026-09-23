"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BedDouble,
  Bell,
  CalendarDays,
  Building2,
  ClipboardCheck,
  CreditCard,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";

type NavItem = { label: string; href: string; icon: LucideIcon };

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Rooms", href: "/rooms", icon: BedDouble },
  { label: "Students", href: "/students", icon: Users },
  { label: "Semesters", href: "/semesters", icon: CalendarDays },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Expenses", href: "/expenses", icon: CircleDollarSign },
  { label: "Reminders", href: "/notifications", icon: Bell },
  { label: "Check-in / Check-out", href: "/occupancy", icon: ClipboardCheck },
  { label: "Student Property", href: "/student-property", icon: PackageSearch },
  { label: "Hostel Assets", href: "/assets", icon: Wrench },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Users & Permissions", href: "/users", icon: ShieldCheck },
  { label: "Settings", href: "/settings", icon: Settings },
];

function Brand({ organizationName }: { organizationName: string }) {
  return (
    <Link className="sidebar-brand" href="/dashboard">
      <span className="brand-mark"><Building2 aria-hidden="true" size={21} /></span>
      <span><strong>{organizationName}</strong><small>Hostel Management</small></span>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link className={active ? "nav-link nav-link-active" : "nav-link"} href={href} key={href} onClick={onNavigate}>
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, organizationName, userName, userRole }: { children: React.ReactNode; organizationName: string; userName: string; userRole: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountLabel = userRole === "OWNER" ? "Landlord/Landlady" : userName;
  const initials = userRole === "OWNER" ? "LL" : userName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand organizationName={organizationName} />
        <Navigation />
        <form action={logoutAction} className="mt-auto">
          <button className="nav-link w-full" type="submit"><LogOut size={19} /><span>Sign out</span></button>
        </form>
      </aside>

      {mobileOpen ? (
        <div className="mobile-sidebar-wrap">
          <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="mobile-sidebar">
            <div className="flex items-center justify-between"><Brand organizationName={organizationName} /><button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
            <Navigation onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <form action="/search" className="topbar-search" method="get" role="search">
            <Search aria-hidden="true" size={18} />
            <input aria-label="Search" name="q" placeholder="Search students, rooms, payments..." />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link className="icon-button notification-button" href="/notifications" aria-label="Open reminders"><Bell size={20} /></Link>
            <div className="profile-button">
              <span className="profile-avatar">{initials}</span>
              <span className="hidden text-left sm:block"><strong>{accountLabel}</strong><small>{userRole === "OWNER" ? "System Administrator" : userRole.charAt(0) + userRole.slice(1).toLowerCase()}</small></span>
            </div>
          </div>
        </header>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
