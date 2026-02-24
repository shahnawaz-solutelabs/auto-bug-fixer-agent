import "./globals.css";
import * as Sentry from "@sentry/nextjs";
import Providers from "./providers.js";

export function generateMetadata() {
  return {
    title: "AI Bug Fixer Agent",
    description: "Chatbot that resolves GitHub bugs and creates PRs automatically",
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
