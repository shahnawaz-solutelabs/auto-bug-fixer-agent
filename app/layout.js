import "./globals.css";
import Providers from "./providers.js";

export const metadata = {
  title: "AI Bug Fixer Agent",
  description: "Chatbot that resolves GitHub bugs and creates PRs automatically",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
