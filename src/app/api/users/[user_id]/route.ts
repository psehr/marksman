import { NextRequest, NextResponse } from "next/server";
import dbSession from "@services/database/session";
import { parseUserFromFirestoreDocument } from "@/src/_services/utils/parsers/user";
import { MarksmanUser } from "@/src/_models/user";

/**
 * GET route for obtaining user data from a user_id in the database.
 * @param request A {@link NextRequest} request.
 * @param params The URL params of the request.
 *
 * @returns A JSON representation of a {@link MarksmanUser}, parsed with the {@link parseUserFromFirestoreDocument} method.
 * @throws A bodyless JSON object, representing a 404 error as a response.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const querry = (
    await dbSession
      .collection("users")
      .doc((await params).user_id)
      .get()
  ).data();
  if (querry) {
    return NextResponse.json(parseUserFromFirestoreDocument(querry));
  } else {
    return NextResponse.json({}, { statusText: "Not Found", status: 404 });
  }
}
