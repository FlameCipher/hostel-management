"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BedDouble, Bell, MessageCircle, CalendarDays, Building2, Globe, ClipboardCheck, CreditCard, CircleDollarSign, LayoutDashboard, LogOut, Menu, PackageSearch, Search, Settings, ShieldCheck, Share2, Smartphone, Users, Wrench, X } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import styles from "./app-shell.module.css";

type NavItem = { label: string; href: string; icon: LucideIcon };
const groups: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "System Assistant", href: "/assistant", icon: MessageCircle },
  ] },
  { title: "Manage property", items: [
    { label: "Rooms", href: "/rooms", icon: BedDouble },
    { label: "Bookings", href: "/bookings", icon: CalendarDays },
    { label: "Students", href: "/students", icon: Users },
    { label: "Visitors", href: "/visitors", icon: ClipboardCheck },
    { label: "Check-in / Check-out", href: "/occupancy", icon: ClipboardCheck },
    { label: "Tenant Registration", href: "/students/registrations", icon: Users },
    { label: "Student Terms", href: "/student-terms", icon: ClipboardCheck },
    { label: "Semesters", href: "/semesters", icon: CalendarDays },
    { label: "Student Property", href: "/student-property", icon: PackageSearch },
    { label: "Hostel Assets", href: "/assets", icon: Wrench },
  ] },
  { title: "Communication", items: [
    { label: "Student Inbox", href: "/communications/inbox", icon: MessageCircle },
    { label: "Communications", href: "/communications", icon: Bell },
    { label: "WhatsApp", href: "/communications/whatsapp", icon: MessageCircle },
    { label: "Reminders", href: "/notifications", icon: Bell },
  ] },
  { title: "Finance", items: [
    { label: "Payments", href: "/payments", icon: CreditCard },
    { label: "Expenses", href: "/expenses", icon: CircleDollarSign },
    { label: "Reports", href: "/reports", icon: BarChart3 },
  ] },
  { title: "Workspace settings", items: [
    { label: "My Website", href: "/website", icon: Globe },
    { label: "Vacancy Card", href: "/vacancy-card", icon: Share2 },
    { label: "Users & Permissions", href: "/users", icon: ShieldCheck },
    { label: "Hostel Setup", href: "/setup", icon: Building2 },
    { label: "HealthFix", href: "/healthfix", icon: ShieldCheck },
    { label: "Install App", href: "/install", icon: Smartphone },
    { label: "My Account", href: "/account", icon: ShieldCheck },
    { label: "Settings", href: "/settings", icon: Settings },
  ] },
];
const navItems = groups.flatMap(group => group.items);

function Brand({ organizationName }: { organizationName: string }) {
  return <Link className={styles.brand} href="/dashboard"><span className={styles.brandMark}><Building2 aria-hidden="true" size={22}/></span><span><strong>{organizationName}</strong><small>PROPERTY MANAGEMENT</small></span></Link>;
}
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = navItems.filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return <nav className={styles.navigation} aria-label="Main navigation">{groups.map(group => <div key={group.title}><p className={styles.groupTitle}>{group.title}</p>{group.items.map(({ label, href, icon: Icon }) => <Link className={`${styles.navLink} ${current === href ? styles.active : ""}`} aria-current={current === href ? "page" : undefined} href={href} key={href} onClick={onNavigate}><Icon aria-hidden="true" size={18}/><span>{label}</span></Link>)}</div>)}</nav>;
}
function SignOut() {
  return <form action={logoutAction} className={styles.signOut}><button className={styles.navLink} type="submit"><LogOut aria-hidden="true" size={18}/><span>Sign out</span></button></form>;
}
export function AppShell({ children, organizationName, userName, userRole }: { children: React.ReactNode; organizationName: string; userName: string; userRole: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const section = navItems.filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "Management";
  const role = ({ OWNER: "Owner", ADMIN: "Administrator", MANAGER: "Manager", CARETAKER: "Caretaker" } as Record<string, string>)[userRole] ?? "Staff";
  const initials = userName.trim().split(/\s+/).map(part => Array.from(part)[0]).join("").slice(0, 2).toUpperCase() || "U";
  useEffect(() => {
    const element = dialog.current;
    if (!mobileOpen || !element) return;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previous; };
  }, [mobileOpen]);
  return <div className={styles.shell}>
    <a className={styles.skipLink} href="#workspace-content">Skip to content</a>
    <aside className={styles.sidebar}><Brand organizationName={organizationName}/><Navigation/><SignOut/></aside>
    <dialog ref={dialog} className={styles.drawer} id="management-navigation" aria-label="Management menu" onClose={() => setMobileOpen(false)}>
      <div className={styles.drawerPanel}><div className={styles.drawerHeader}><Brand organizationName={organizationName}/><button type="button" className={styles.iconButton} aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} aria-hidden="true"/></button></div><Navigation onNavigate={() => setMobileOpen(false)}/><SignOut/></div>
      <button type="button" className={styles.backdrop} aria-label="Close menu backdrop" tabIndex={-1} onClick={() => setMobileOpen(false)}/>
    </dialog>
    <div className={styles.main}><header className={styles.topbar}>
      <button className={`${styles.iconButton} ${styles.menuButton}`} type="button" onClick={() => setMobileOpen(true)} aria-label="Open management menu" aria-expanded={mobileOpen} aria-controls="management-navigation"><Menu aria-hidden="true" size={22}/></button>
      <div className={styles.workspaceName}><strong title={organizationName}>{organizationName}</strong><span>{section}</span></div>
      <form action="/search" className={styles.search} method="get" role="search"><Search aria-hidden="true" size={17}/><input aria-label="Search" name="q" placeholder="Search your workspace…"/></form>
      <div className={styles.headerActions}><Link className={styles.iconButton} href="/notifications" aria-label="Open reminders"><Bell aria-hidden="true" size={20}/></Link><Link href="/account" className={styles.profile} aria-label={`My account, ${userName}, ${role}`}><span className={styles.avatar}>{initials}</span><span className={styles.profileName}><strong>{userName}</strong><small>{role}</small></span></Link></div>
    </header><main id="workspace-content" className={`content-area ${styles.content}`} tabIndex={-1}>{children}</main></div>
  </div>;
}
