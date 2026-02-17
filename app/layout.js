import "./globals.css";

export const metadata = {
  title: "MTRX Ops Dashboard",
  description: "MTRX Media Operations Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
