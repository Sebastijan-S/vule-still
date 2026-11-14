import { Header, Footer } from "@/components/site-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><Header />{children}<Footer /></>;
}
