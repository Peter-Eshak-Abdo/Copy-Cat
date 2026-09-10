import type { Metadata } from "next";
import { AdminClientWrapper } from "./admin-client-wrapper";

export const metadata: Metadata = {
  title: "لوحة التحكم | Copy Cat",
  manifest: "/manifest-admin.json",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminClientWrapper>{children}</AdminClientWrapper>;
}
