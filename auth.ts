import NextAuth from "next-auth";
import osu, { OsuProfile } from "next-auth/providers/osu";
import { newUser, OsuUser } from "./src/_models/user";
import dbSession from "@services/database/session";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [osu],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile }) {
      const osuProfile = profile as unknown as OsuProfile;
      const dbUserExists = (
        await dbSession.collection("users").doc(osuProfile.id.toString()).get()
      ).exists;
      if (!dbUserExists) {
        dbSession
          .collection("users")
          .doc(osuProfile.id.toString())
          .create(
            newUser(
              {
                id: osuProfile.id,
                name: osuProfile.username,
                image: osuProfile.avatar_url,
                country_code: osuProfile.country_code,
              },
              osuProfile.cover.custom_url!
            )
          );
      }
      return true;
    },
  },
});
