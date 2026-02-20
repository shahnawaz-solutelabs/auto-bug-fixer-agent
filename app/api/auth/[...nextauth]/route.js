import _NextAuth from "next-auth";
import _GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getClientPromise } from "../../../../src/lib/mongodb.js";

const NextAuth = _NextAuth.default || _NextAuth;
const GoogleProvider = _GoogleProvider.default || _GoogleProvider;

let _authOptions = null;

export function getAuthOptions() {
  if (_authOptions) return _authOptions;

  _authOptions = {
    adapter: MongoDBAdapter(getClientPromise()),
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    ],
    session: {
      strategy: "jwt",
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.userId = user.id;
        }
        return token;
      },
      async session({ session, token }) {
        if (token?.userId) {
          session.user.id = token.userId;
        }
        return session;
      },
    },
    pages: {
      signIn: "/",
    },
  };

  return _authOptions;
}

function handler(req, ctx) {
  return NextAuth(req, ctx, getAuthOptions());
}

export { handler as GET, handler as POST };
