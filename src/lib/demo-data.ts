export const dashboardMetrics = [
  { label: "Total Rooms", value: "24", tone: "blue" },
  { label: "Occupied", value: "18", tone: "green" },
  { label: "Vacant", value: "6", tone: "sky" },
  { label: "Total Students", value: "31", tone: "violet" },
] as const;

export const monthlyCollections = [
  { month: "Jan", collected: 40, expected: 60 },
  { month: "Feb", collected: 60, expected: 70 },
  { month: "Mar", collected: 75, expected: 95 },
  { month: "Apr", collected: 85, expected: 100 },
  { month: "May", collected: 98, expected: 112 },
  { month: "Jun", collected: 86, expected: 111 },
] as const;

export const roomOverview = [
  { room: "Room 1", occupancy: "2 / 2", status: "Occupied" },
  { room: "Room 2", occupancy: "2 / 2", status: "Occupied" },
  { room: "Room 3", occupancy: "2 / 2", status: "Occupied" },
  { room: "Room 4", occupancy: "2 / 2", status: "Occupied" },
  { room: "Room 5", occupancy: "0 / 2", status: "Vacant" },
  { room: "Room 6", occupancy: "2 / 2", status: "Occupied" },
] as const;

export const recentPayments = [
  { student: "Wanjiku Kamau", room: "Room 3", amount: "KES 14,000", status: "Fully Paid", date: "12 Mar 2026" },
  { student: "Brian Otieno", room: "Room 1", amount: "KES 14,000", status: "Fully Paid", date: "10 Mar 2026" },
  { student: "Amina Hassan", room: "Room 4", amount: "KES 8,000", status: "Balance Due", date: "08 Mar 2026" },
  { student: "Kelvin Mwangi", room: "Room 2", amount: "KES 14,000", status: "Fully Paid", date: "06 Mar 2026" },
  { student: "Faith Chepkemoi", room: "Room 6", amount: "KES 10,000", status: "Balance Due", date: "05 Mar 2026" },
] as const;
