import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
