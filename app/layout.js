import "./globals.css";

export const metadata = {
  title: "AI Bug Fixer Agent",
  description: "Chatbot that resolves GitHub bugs and creates PRs automatically",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
