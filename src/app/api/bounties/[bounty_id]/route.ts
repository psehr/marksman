import { NextRequest, NextResponse } from "next/server";
import dbSession from "@services/database/session";
import { parseBountyFromFirestoreDocument } from "@/src/_services/utils/parsers/bounty";
import { Bounty } from "@/src/_models/bounty";

/**
 * GET route for obtaining an existing bounty from its bounty_id in the database.
 * @param request A {@link NextRequest} request.
 * @param params The URL params of the request.
 * @returns A JSON representation of a {@link Bounty}, parsed with the {@link parseBountyFromFirestoreDocument} method.
 * @throws A bodyless JSON object, representing a 404 error as a response.
 *
 * @example GET "http://API_URL/bounties/727"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bounty_id: string }> }
) {
  const querry = (
    await dbSession
      .collection("bounties")
      .doc((await params).bounty_id)
      .get()
  ).data();
  if (querry) {
    return NextResponse.json(parseBountyFromFirestoreDocument(querry));
  } else {
    return NextResponse.json({}, { statusText: "Not Found", status: 404 });
  }
}
